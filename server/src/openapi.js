// OpenAPI 3.0 description of the Sweety API, served at /api/openapi.json and rendered by Swagger UI at
// /api/docs. A test (tests/openapi.test.js) compares this file with the routes Express actually
// registers, so the docs cannot silently drift from the code.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const body = (schema) => ({ required: true, content: json(schema) });
const ok = (description, schema) => ({ description, ...(schema ? { content: json(schema) } : {}) });
const param = (name, where, schema, description, required = where === 'path') => ({ name, in: where, required, description, schema });
const idParam = (what) => param('id', 'path', { type: 'integer', minimum: 1 }, `${what} id`);
const dateQuery = (name, description) => param(name, 'query', { type: 'string', format: 'date' }, description);

const R = {
  400: { description: 'Validation failed. `error.field` names the offending field.', content: json(ref('Error')) },
  401: { description: 'Not signed in, or the session expired / was revoked.', content: json(ref('Error')) },
  403: { description: 'Signed in but not allowed (wrong role, patient has not shared, doctor not verified).', content: json(ref('Error')) },
  404: { description: 'Not found (also returned for other users\' readings, so ids cannot be probed).', content: json(ref('Error')) },
  409: { description: 'Conflict (duplicate slot, day already has 4 readings, email taken).', content: json(ref('Error')) },
  429: { description: 'Account temporarily locked after too many failed sign-ins.', content: json(ref('Error')) },
};
const only = (...codes) => Object.fromEntries(codes.map((c) => [c, R[c]]));
const secured = [{ cookieAuth: [] }, { bearerAuth: [] }];

const op = (tag, summary, extra = {}, { auth = true, description } = {}) => ({
  tags: [tag], summary, ...(description ? { description } : {}), ...(auth ? { security: secured } : { security: [] }), ...extra,
});

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Sweety API',
    version: '1.0.0',
    description:
      'Blood glucose tracker API. Browsers authenticate with an httpOnly session cookie set by `/auth/login`; scripts and other API clients can send the `token` from the login response as `Authorization: Bearer <token>`.\n\n' +
      'Errors always look like `{ "error": { "message", "field?", "code?" } }`. Dates are `YYYY-MM-DD` calendar dates; "today" and the future-date rule follow the signed-in user\'s timezone.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth' }, { name: 'Account' }, { name: 'Readings' }, { name: 'Reports' }, { name: 'Care team' }, { name: 'Doctor' }, { name: 'Push' }, { name: 'System' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sweety_session' },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'object', properties: { message: { type: 'string' }, field: { type: 'string' }, code: { type: 'string', example: 'DUPLICATE_SLOT' } }, required: ['message'] } },
      },
      Slot: { type: 'string', enum: ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'] },
      Tag: { type: 'string', enum: ['exercise', 'big_meal', 'medication', 'illness', 'stress', 'poor_sleep', 'alcohol', 'travel'] },
      Settings: {
        type: 'object',
        properties: {
          fastingLow: { type: 'integer' }, fastingHigh: { type: 'integer' }, postLow: { type: 'integer' }, postHigh: { type: 'integer' },
          reminderEnabled: { type: 'boolean' }, reminderTime: { type: 'string', example: '20:00' }, reminderEmail: { type: 'boolean' }, reminderPush: { type: 'boolean' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['patient', 'doctor'] },
          timezone: { type: 'string', example: 'Asia/Kolkata' }, emailVerified: { type: 'boolean' },
          doctorStatus: { type: 'string', nullable: true, enum: ['pending', 'verified', 'rejected'] }, licenseNumber: { type: 'string', nullable: true },
          settings: ref('Settings'),
        },
      },
      Session: { type: 'object', properties: { user: ref('User'), token: { type: 'string', description: 'JWT, for non-browser clients. Browsers use the cookie.' } } },
      ReadingInput: {
        type: 'object',
        required: ['date', 'slot', 'value'],
        properties: {
          date: { type: 'string', format: 'date', description: 'Cannot be in the future (in the user\'s timezone).' },
          slot: ref('Slot'),
          value: { type: 'integer', minimum: 40, maximum: 600, description: 'mg/dl, whole number.' },
          notes: { type: 'string', nullable: true, maxLength: 280 },
          tags: { type: 'array', items: ref('Tag') },
        },
      },
      Reading: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, date: { type: 'string', format: 'date' }, slot: ref('Slot'), slotLabel: { type: 'string' }, value: { type: 'integer' },
          notes: { type: 'string', nullable: true }, tags: { type: 'array', items: ref('Tag') }, status: { type: 'string', enum: ['low', 'ok', 'high'], description: 'Only present inside reports.' },
        },
      },
      Alert: {
        type: 'object', nullable: true,
        description: 'Present when a saved reading is low. `critical` means under 54 mg/dl.',
        properties: { level: { type: 'string', enum: ['low', 'critical'] }, title: { type: 'string' }, message: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } },
      },
      Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
      Comment: {
        type: 'object',
        properties: { id: { type: 'integer' }, date: { type: 'string', format: 'date' }, body: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, doctor: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } } },
      },
      Report: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['daily', 'month-to-date', 'monthly'] }, selectedDate: { type: 'string', format: 'date' },
          from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, empty: { type: 'boolean' },
          stats: { type: 'object', nullable: true, properties: { count: { type: 'integer' }, highest: { type: 'integer' }, lowest: { type: 'integer' }, average: { type: 'number', description: 'Rounded to 1 decimal.' } } },
          timeInRange: { type: 'object', nullable: true, properties: { inRange: { type: 'number' }, low: { type: 'number' }, high: { type: 'number' } } },
          estimatedA1c: { type: 'number', nullable: true, description: 'Null until at least 10 readings.' },
          targets: { type: 'object', description: 'The patient\'s own target ranges used for this report.' },
          readings: { type: 'array', items: ref('Reading') }, comments: { type: 'array', items: ref('Comment') }, cached: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/health': { get: op('System', 'Liveness check', { responses: { 200: ok('Service is up', { type: 'object', properties: { ok: { type: 'boolean' } } }) } }, { auth: false }) },

    '/auth/signup': {
      post: op('Auth', 'Create an account', {
        requestBody: body({ type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 72 }, role: { type: 'string', enum: ['patient', 'doctor'], default: 'patient' }, timezone: { type: 'string', example: 'Asia/Kolkata' }, licenseNumber: { type: 'string', description: 'Required for doctors; they stay pending until an admin verifies it.' } } }),
        responses: { 201: ok('Account created and signed in (sets the session cookie)', ref('Session')), ...only(400, 409) },
      }, { auth: false }),
    },
    '/auth/login': {
      post: op('Auth', 'Sign in', {
        requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } }),
        responses: { 200: ok('Signed in (sets the session cookie)', ref('Session')), ...only(400, 401, 429) },
      }, { auth: false, description: 'After 5 wrong passwords the account is locked for 15 minutes; a password reset clears the lock.' }),
    },
    '/auth/logout': { post: op('Auth', 'Sign out of this browser', { responses: { 204: { description: 'Session cookie cleared' } } }, { auth: false }) },
    '/auth/logout-all': { post: op('Auth', 'Sign out of every device', { responses: { 204: { description: 'All sessions revoked' }, ...only(401) } }) },
    '/auth/me': { get: op('Auth', 'Current user', { responses: { 200: ok('The signed-in user', { type: 'object', properties: { user: ref('User') } }), ...only(401) } }) },
    '/auth/verify-email': {
      post: op('Auth', 'Confirm an email address', { requestBody: body({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }), responses: { 200: ok('Verified'), ...only(400) } }, { auth: false }),
    },
    '/auth/resend-verification': { post: op('Auth', 'Resend the verification email', { responses: { 200: ok('Sent (or already verified)'), ...only(401) } }) },
    '/auth/forgot-password': {
      post: op('Auth', 'Email a password reset link', {
        requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }),
        responses: { 200: ok('Always succeeds, so the endpoint cannot be used to discover which emails have accounts'), ...only(400) },
      }, { auth: false }),
    },
    '/auth/reset-password': {
      post: op('Auth', 'Set a new password from an emailed token', {
        requestBody: body({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } }),
        responses: { 200: ok('Password changed; every existing session is signed out'), ...only(400) },
      }, { auth: false }),
    },
    '/auth/change-password': {
      post: op('Auth', 'Change password', {
        requestBody: body({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } }),
        responses: { 200: ok('Changed; other devices are signed out, this one stays signed in'), ...only(400, 401) },
      }),
    },

    '/me/settings': {
      patch: op('Account', 'Update profile, timezone, target ranges and reminders', {
        requestBody: body({ type: 'object', properties: { name: { type: 'string' }, timezone: { type: 'string' }, fastingLow: { type: 'integer' }, fastingHigh: { type: 'integer' }, postLow: { type: 'integer' }, postHigh: { type: 'integer' }, reminderEnabled: { type: 'boolean' }, reminderTime: { type: 'string', example: '20:00' }, reminderEmail: { type: 'boolean' }, reminderPush: { type: 'boolean' } } }),
        responses: { 200: ok('Updated user', { type: 'object', properties: { user: ref('User') } }), ...only(400, 401) },
      }),
    },
    '/me/export': { get: op('Account', 'Download all your data as JSON', { responses: { 200: { description: 'A JSON file (`sweety-data.json`) with your profile, readings, shares and comments', content: json({ type: 'object' }) }, ...only(401) } }) },
    '/me': {
      delete: op('Account', 'Permanently delete your account and all data', {
        requestBody: body({ type: 'object', required: ['password'], properties: { password: { type: 'string', description: 'Confirms it is really you.' } } }),
        responses: { 204: { description: 'Deleted; the session cookie is cleared' }, ...only(400, 401) },
      }),
    },
    '/me/doctors': {
      get: op('Care team', 'Doctors you share with', { responses: { 200: ok('Doctors', { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' } } } } } }), ...only(401, 403) } }),
      post: op('Care team', 'Share your readings with a verified doctor', {
        requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }),
        responses: { 201: ok('Shared'), ...only(400, 401, 403, 404) },
      }),
    },
    '/me/doctors/{id}': { delete: op('Care team', 'Stop sharing with a doctor', { parameters: [idParam('Doctor')], responses: { 204: { description: 'Revoked' }, ...only(400, 401, 403) } }) },
    '/me/comments': {
      get: op('Care team', 'Comments your doctors left for you', { parameters: [param('limit', 'query', { type: 'integer', maximum: 50 }, 'Max comments')], responses: { 200: ok('Comments, newest day first', { type: 'object', properties: { data: { type: 'array', items: ref('Comment') } } }), ...only(401, 403) } }),
    },

    '/readings': {
      get: op('Readings', 'List your readings (paginated)', {
        parameters: [
          param('page', 'query', { type: 'integer', minimum: 1, default: 1 }, 'Page number'), param('limit', 'query', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Page size'),
          dateQuery('date', 'Only this day'), dateQuery('from', 'From (inclusive)'), dateQuery('to', 'To (inclusive)'),
          param('tag', 'query', ref('Tag'), 'Only readings with this tag'), param('q', 'query', { type: 'string', maxLength: 100 }, 'Search notes'),
        ],
        responses: { 200: ok('A page of readings, newest first', { type: 'object', properties: { data: { type: 'array', items: ref('Reading') }, pagination: ref('Pagination') } }), ...only(400, 401, 403) },
      }),
      post: op('Readings', 'Add a reading', {
        requestBody: body(ref('ReadingInput')),
        responses: { 201: ok('Created. `alert` is set when the value is low.', { type: 'object', properties: { reading: ref('Reading'), alert: ref('Alert') } }), ...only(400, 401, 403, 409) },
      }, { description: 'Rules: value is a whole number 40-600; date is not in the future; one reading per slot per day; at most 4 per day.' }),
    },
    '/readings/export.csv': {
      get: op('Readings', 'Export readings as CSV', {
        parameters: [dateQuery('from', 'From (inclusive)'), dateQuery('to', 'To (inclusive)'), param('tag', 'query', ref('Tag'), 'Tag filter'), param('q', 'query', { type: 'string' }, 'Notes search')],
        responses: { 200: { description: 'CSV file (oldest first)', content: { 'text/csv': { schema: { type: 'string' } } } }, ...only(400, 401, 403) },
      }),
    },
    '/readings/{id}': {
      get: op('Readings', 'Get one reading', { parameters: [idParam('Reading')], responses: { 200: ok('The reading', { type: 'object', properties: { reading: ref('Reading') } }), ...only(400, 401, 403, 404) } }),
      put: op('Readings', 'Edit a reading', { parameters: [idParam('Reading')], requestBody: body(ref('ReadingInput')), responses: { 200: ok('Updated', { type: 'object', properties: { reading: ref('Reading'), alert: ref('Alert') } }), ...only(400, 401, 403, 404, 409) } }),
      delete: op('Readings', 'Delete a reading', { parameters: [idParam('Reading')], responses: { 204: { description: 'Deleted' }, ...only(400, 401, 403, 404) } }),
    },

    '/reports/{type}': {
      get: op('Reports', 'Daily, month-to-date or previous-month report', {
        parameters: [
          param('type', 'path', { type: 'string', enum: ['daily', 'month-to-date', 'monthly'] }, '`daily` = the date; `month-to-date` = 1st of that month to the date; `monthly` = the whole previous month'),
          dateQuery('date', 'Selected date (default: today in your timezone)'),
          param('patientId', 'query', { type: 'integer' }, 'Doctors only: the patient to report on'),
        ],
        responses: { 200: ok('The report', ref('Report')), ...only(400, 401, 403) },
      }),
    },

    '/doctor/patients': { get: op('Doctor', 'Patients who shared with you', { responses: { 200: ok('Patients', { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, lastReadingDate: { type: 'string', nullable: true }, readingsLast30Days: { type: 'integer' } } } } } }), ...only(401, 403) } }) },
    '/doctor/patients/{id}/readings': { get: op('Doctor', 'A patient\'s readings (paginated)', { parameters: [idParam('Patient'), param('page', 'query', { type: 'integer' }, 'Page'), param('limit', 'query', { type: 'integer' }, 'Page size')], responses: { 200: ok('A page of readings', { type: 'object', properties: { data: { type: 'array', items: ref('Reading') }, pagination: ref('Pagination') } }), ...only(400, 401, 403) } }) },
    '/doctor/patients/{id}/comments': {
      get: op('Doctor', 'Comments on a patient', { parameters: [idParam('Patient')], responses: { 200: ok('Comments', { type: 'object', properties: { data: { type: 'array', items: ref('Comment') } } }), ...only(400, 401, 403) } }),
      post: op('Doctor', 'Leave a comment on a patient\'s day (emails and pushes the patient)', {
        parameters: [idParam('Patient')],
        requestBody: body({ type: 'object', required: ['date', 'body'], properties: { date: { type: 'string', format: 'date' }, body: { type: 'string', maxLength: 1000 } } }),
        responses: { 201: ok('Created', { type: 'object', properties: { comment: ref('Comment') } }), ...only(400, 401, 403) },
      }),
    },
    '/doctor/comments/{id}': { delete: op('Doctor', 'Delete your own comment', { parameters: [idParam('Comment')], responses: { 204: { description: 'Deleted' }, ...only(400, 401, 403, 404) } }) },

    '/push/public-key': { get: op('Push', 'VAPID public key for web push', { responses: { 200: ok('Whether push is enabled and the key to subscribe with', { type: 'object', properties: { enabled: { type: 'boolean' }, publicKey: { type: 'string', nullable: true } } }), ...only(401) } }) },
    '/push/subscribe': {
      post: op('Push', 'Register this device for push notifications', {
        requestBody: body({ type: 'object', required: ['endpoint', 'keys'], properties: { endpoint: { type: 'string', format: 'uri' }, keys: { type: 'object', properties: { p256dh: { type: 'string' }, auth: { type: 'string' } } } } }),
        responses: { 201: ok('Subscribed'), ...only(400, 401) },
      }),
    },
    '/push/unsubscribe': {
      post: op('Push', 'Remove this device', { requestBody: body({ type: 'object', properties: { endpoint: { type: 'string' } } }), responses: { 204: { description: 'Removed' }, ...only(401) } }),
    },
  },
};

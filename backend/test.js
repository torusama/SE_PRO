const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:an232006@localhost:5432/vinhhang' });
client.connect()
  .then(() => client.query("INSERT INTO user_preferences (user_id, session_id, memory_key, content, memory_type) VALUES (NULL, 'test-consent-6', 'maximum_budget', '100 triệu', 'fact')"))
  .then(() => { console.log('Done'); client.end(); })
  .catch(console.error);

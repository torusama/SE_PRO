const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:an232006@localhost:5432/vinhhang' });
client.connect()
  .then(() => client.query("UPDATE service_types SET is_active = false WHERE name = 'Dịch vụ mai táng'"))
  .then(res => { console.log('Updated', res.rowCount); client.end(); })
  .catch(console.error);

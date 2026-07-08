// backend/hash.js
const bcrypt = require('bcrypt');

const accounts = [
  { email: 'admin1@gmail.com', password: 'Admin@2026' },
  { email: 'admin2@gmail.com', password: 'QuanTri@123' },
  { email: 'admin3@gmail.com', password: 'Nghiatrang@789' },
];

(async () => {
  for (const acc of accounts) {
    const hash = await bcrypt.hash(acc.password, 10);
    console.log(`EMAIL: ${acc.email}`);
    console.log(`HASH : ${hash}`);
    console.log('---');
  }
})();
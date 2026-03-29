require('dotenv').config({ path: './.env' });
const { Lawyer } = require('./models');

async function checkCount() {
    const count = await Lawyer.count();
    console.log("Total Lawyers:", count);
    process.exit();
}
checkCount();

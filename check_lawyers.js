require('dotenv').config({ path: './.env' });
const { Lawyer, User } = require('./models');

async function checkLawyers() {
    try {
        const lawyers = await Lawyer.findAll({
            include: [{ model: User, as: 'user', attributes: ['email', 'full_name'] }],
            order: [['created_at', 'DESC']],
            limit: 5
        });
        console.log("Recent Lawyers:", JSON.stringify(lawyers, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
    process.exit();
}
checkLawyers();

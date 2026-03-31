const nodemailer = require('nodemailer');
require('dotenv').config();

const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const EMAIL_HOST = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT, 10) || 587;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true' || EMAIL_PORT === 465;

console.log('--- 🔍 DIAGNOSTIC START ---');
console.log('User:', EMAIL_USER || '(NOT SET)');
console.log('Host:', EMAIL_HOST);
console.log('Port:', EMAIL_PORT);
console.log('Secure:', EMAIL_SECURE);
console.log('Pass Length:', EMAIL_PASS.length);

if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ Missing EMAIL_USER or EMAIL_PASS environment variables!');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

console.log('⏳ Testing connection...');

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Verification failed:');
        console.error(JSON.stringify({
            code: error.code,
            command: error.command,
            response: error.response,
            message: error.message,
            stack: error.stack
        }, null, 2));
        
        if (error.code === 'EAUTH') {
            console.log('\n💡 Tip: Check if you are using Gmail App Password (16 chars).');
        } else if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
            console.log('\n💡 Tip: This might be a firewall/network issue on the server.');
        }
    } else {
        console.log('✅ SMTP Server is ready to take our messages!');
        
        console.log('⏳ Sending test email to', EMAIL_USER, '...');
        transporter.sendMail({
            from: `"Diagnostic Test" <${EMAIL_USER}>`,
            to: EMAIL_USER,
            subject: 'Test Email from Railway',
            text: 'If you see this, email is working perfectly!'
        }, (err, info) => {
            if (err) {
                console.error('❌ Failed to send test email:', err.message);
            } else {
                console.log('✅ Test email sent successfully!');
                console.log('MessageID:', info.messageId);
            }
        });
    }
});

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'trildse180473@fpt.edu.vn',
        pass: 'puzwkvsgeioobkie'
    }
});
transporter.verify().then(() => console.log('OK 465')).catch(e => console.error('465 ERR:', e.message));

const t587 = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'trildse180473@fpt.edu.vn',
        pass: 'puzwkvsgeioobkie'
    }
});
t587.verify().then(() => console.log('OK 587')).catch(e => console.error('587 ERR:', e.message));

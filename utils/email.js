const nodemailer = require('nodemailer');
const { Resend } = require('resend');
require('dotenv').config();

const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const getEmailUser = () => (process.env.EMAIL_USER || '').trim();
const getEmailPass = () => (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

/**
 * Lấy địa chỉ email gửi đi
 */
const getEmailFrom = () => {
    // Nếu có API Resend, ưu tiên dùng địa chỉ từ Resend (hoặc onboarding nếu chưa có domain)
    if (process.env.RESEND_API_KEY) {
        return process.env.RESEND_FROM || 'onboarding@resend.dev';
    }

    const emailUser = getEmailUser();
    const configuredFrom = (process.env.EMAIL_FROM || '').trim();
    const smtpHost = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim().toLowerCase();

    if (smtpHost.includes('gmail.com')) {
        return emailUser;
    }

    return configuredFrom || emailUser;
};

// Khởi tạo Resend instance (nếu có API Key)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Tạo transporter cho email (dự phòng SMTP)
 */
const createTransporter = () => {
    const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    
    const envSecure = process.env.EMAIL_SECURE;
    const isSecure = envSecure 
        ? String(envSecure).toLowerCase() === 'true' 
        : port === 465;

    console.log(`📡 SMTP CONFIG: ${host}:${port} (Secure: ${isSecure}) | User: ${getEmailUser()}`);
    
    return nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: {
            user: getEmailUser(),
            pass: getEmailPass()
        },
        connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) || 20000,
        greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) || 20000,
        socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT, 10) || 30000,
        family: 4, // Ép dùng IPv4
        tls: { rejectUnauthorized: false }
    });
};

/**
 * Hàm gửi mail chung (tự động chọn Resend hoặc SMTP)
 */
const sendMailInternal = async ({ to, subject, html, text }) => {
    // 1. Ưu tiên dùng Resend (REST API - Cổng 443 không bao giờ bị chặn)
    if (resend) {
        console.log(`📤 [Resend] Sending email to: ${to}...`);
        const { data, error } = await resend.emails.send({
            from: `"Lawyer Platform" <${getEmailFrom()}>`,
            to,
            subject,
            html,
            text
        });
        if (error) {
            console.error('❌ Resend Error:', error);
            throw error;
        }
        console.log('✅ Resend sent successfully:', data.id);
        return { success: true, messageId: data.id };
    }

    // 2. Dự phòng SMTP hoặc Mock
    if (!getEmailUser() || !getEmailPass()) {
        console.log('📧 [MOCK EMAIL] To:', to, '| Subject:', subject);
        return { success: true, mocked: true };
    }

    const transporter = createTransporter();
    console.log(`📧 [SMTP] Sending email to: ${to}...`);
    const info = await transporter.sendMail({
        from: `"Lawyer Platform" <${getEmailFrom()}>`,
        to,
        subject,
        html,
        text
    });
    console.log('✅ SMTP sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
};

/**
 * Gửi email đặt lại mật khẩu
 */
const sendPasswordResetEmail = async (email, fullName, resetToken) => {
    try {
        const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;
        await sendMailInternal({
            to: email,
            subject: 'Đặt lại mật khẩu - Lawyer Platform',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Đặt lại mật khẩu</h2>
                    <p>Xin chào <strong>${fullName}</strong>,</p>
                    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Vui lòng click vào link bên dưới để đặt lại mật khẩu:</p>
                    <p style="margin: 20px 0; text-align: center;">
                        <a href="${resetUrl}" 
                           style="background-color: #2563eb; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Đặt lại mật khẩu
                        </a>
                    </p>
                    <p>Hoặc copy link này vào trình duyệt:</p>
                    <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                    <p><strong>Lưu ý:</strong> Link này chỉ có hiệu lực trong 1 giờ.</p>
                    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendPasswordResetEmail:', error);
    }
};

/**
 * Gửi email xác thực tài khoản
 */
const sendVerifyEmail = async (email, fullName, verifyUrl) => {
    return new Promise((resolve) => {
        setImmediate(async () => {
            try {
                const result = await sendMailInternal({
                    to: email,
                    subject: 'Xác thực email tài khoản',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px;">
                            <h2 style="color: #041837; font-weight: 800; text-transform: uppercase;">Xác thực tài khoản</h2>
                            <p style="font-size: 16px; color: #475569;">Xin chào <b>${fullName}</b>,</p>
                            <p style="line-height: 1.6;">Cảm ơn bạn đã đăng ký tại hệ thống Hiểu Luật. Vui lòng nhấn vào nút bên dưới để xác thực email và bắt đầu sử dụng dịch vụ:</p>
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${verifyUrl}" 
                                   style="background-color: #041837; color: white; padding: 16px 32px; 
                                          text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 800; letter-spacing: 1px;">
                                    XÁC THỰC NGAY
                                </a>
                            </div>
                            <p style="word-break: break-all; color: #0f172a; font-size: 13px;">${verifyUrl}</p>
                        </div>
                    `
                });
                resolve(result);
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    });
};

const sendInquiryConfirmationEmail = async (email, fullName) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Xác nhận yêu cầu tư vấn - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px;">
                    <h2 style="color: #041837;">Xác nhận yêu cầu</h2>
                    <p>Xin chào <strong>${fullName}</strong>,</p>
                    <p>Chúng tôi đã nhận được yêu cầu tư vấn pháp lý của bạn. Đội ngũ chuyên gia sẽ xem xét và liên hệ lại sớm nhất.</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryConfirmationEmail:', error);
    }
};

const sendInquiryAcceptedEmail = async (email, fullName, lawyerName) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Yêu cầu tư vấn của bạn đã được tiếp nhận',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px;">
                    <h2 style="color: #041837;">Luật sư đã tiếp nhận</h2>
                    <p>Xin chào <strong>${fullName}</strong>,</p>
                    <p>Yêu cầu của bạn đã được <strong>Luật sư ${lawyerName}</strong> tiếp nhận xử lý.</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryAcceptedEmail:', error);
    }
};

const sendInquiryResolvedEmail = async (email, fullName, lawyerName, reply) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Kết quả phản hồi tư vấn pháp lý',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px;">
                    <h2 style="color: #10b981;">Kết quả tư vấn</h2>
                    <p>Xin chào <strong>${fullName}</strong>,</p>
                    <p>Luật sư <strong>${lawyerName}</strong> đã phản hồi yêu cầu của bạn:</p>
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px;">${reply}</div>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryResolvedEmail:', error);
    }
};

const sendNegotiationEmail = async (email, fullName, message) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Yêu cầu thương thảo mức phí tư vấn',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px;">
                    <h2 style="color: #f59e0b;">Yêu cầu thương thảo</h2>
                    <p>Xin chào Luật sư <strong>${fullName}</strong>,</p>
                    <p>Nội dung từ Admin:</p>
                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px;">${message}</div>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendNegotiationEmail:', error);
    }
};

const verifySmtpConnection = async () => {
    try {
        if (process.env.RESEND_API_KEY) {
            console.log('✅ EMAIL: Using Resend (REST API). Skipping SMTP check.');
            return;
        }
        if (!getEmailUser() || !getEmailPass()) {
            console.log('⚠️ EMAIL: No SMTP config. Mock mode active.');
            return;
        }
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ SMTP: Connection successful!');
    } catch (error) {
        console.warn('⚠️ SMTP: Connection failed. Error:', error.message);
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendVerifyEmail,
    sendInquiryConfirmationEmail,
    sendInquiryAcceptedEmail,
    sendInquiryResolvedEmail,
    sendNegotiationEmail,
    verifySmtpConnection
};

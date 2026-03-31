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
            subject: 'Đặt lại mật khẩu - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #041837; margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 800;">HỆ THỐNG HIỂU LUẬT</h1>
                    </div>
                    <h2 style="color: #041837; border-bottom: 2px solid #f5b301; padding-bottom: 10px; display: inline-block;">Đặt lại mật khẩu</h2>
                    <p style="font-size: 16px; color: #475569;">Xin chào <strong>${fullName}</strong>,</p>
                    <p style="line-height: 1.6; color: #1e293b;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấn vào nút bên dưới để tiến hành thay đổi:</p>
                    <div style="margin: 35px 0; text-align: center;">
                        <a href="${resetUrl}" 
                           style="background-color: #041837; color: #ffffff; padding: 16px 32px; 
                                  text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 800; letter-spacing: 1px;">
                            THAY ĐỔI MẬT KHẨU
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; font-style: italic;">Link này chỉ có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
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
                    subject: 'Xác thực tài khoản - Hệ thống Hiểu Luật',
                    html: `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #041837; margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 800;">HỆ THỐNG HIỂU LUẬT</h1>
                                <div style="height: 3px; width: 60px; background-color: #f5b301; margin: 10px auto;"></div>
                            </div>
                            <p style="font-size: 17px; color: #1e293b;">Xin chào <strong style="color: #041837;">${fullName}</strong>,</p>
                            <p style="line-height: 1.8; color: #475569;">Cảm ơn bạn đã lựa chọn tin tưởng Hệ thống Hiểu Luật. Để bắt đầu trải nghiệm dịch vụ pháp lý chuyên nghiệp, bạn vui lòng nhấn vào nút xác thực bên dưới:</p>
                            <div style="margin: 40px 0; text-align: center;">
                                <a href="${verifyUrl}" 
                                   style="background-color: #041837; color: #ffffff; padding: 18px 36px; 
                                          text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 800; letter-spacing: 1px; box-shadow: 0 4px 10px rgba(4, 24, 55, 0.2);">
                                    XÁC THỰC NGAY
                                </a>
                            </div>
                            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 30px;">
                                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                                    <b>Lưu ý:</b> Link xác thực có hiệu lực trong vòng 24 giờ. Nếu nút trên không hoạt động, bạn có thể copy link sau vào trình duyệt:
                                    <br><span style="color: #041837; word-break: break-all;">${verifyUrl}</span>
                                </p>
                            </div>
                            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px;">
                                © 2026 Admin - Hệ thống Hiểu Luật. Mọi quyền được bảo lưu.
                            </p>
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

/**
 * Gửi email xác nhận yêu cầu tư vấn (Khách hàng)
 */
const sendInquiryConfirmationEmail = async (email, fullName) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Xác nhận yêu cầu tư vấn - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
                    <div style="background-color: #041837; color: #ffffff; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">XÁC NHẬN YÊU CẦU</h1>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 17px;">Xin chào <strong>${fullName}</strong>,</p>
                        <p style="line-height: 1.7; color: #475569;">Chúng tôi đã nhận được yêu cầu tư vấn pháp lý của bạn thông qua website <b>Hiểu Luật</b>. Cảm ơn bạn đã tin tưởng!</p>
                        <div style="border-left: 4px solid #f5b301; background-color: #f8fafc; padding: 20px; margin: 25px 0;">
                            <p style="margin: 0; color: #1e293b; font-style: italic;">
                                "Đội ngũ chuyên gia pháp lý của chúng tôi đang xem xét nội dung và sẽ phản hồi cho bạn trong thời gian sớm nhất."
                            </p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">Bạn có thể đăng nhập vào Dashboard bằng email này để theo dõi tiến trình xử lý yêu cầu.</p>
                        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                            <p style="margin: 0; font-weight: 800; color: #041837;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                        </div>
                    </div>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryConfirmationEmail:', error);
    }
};

/**
 * Gửi email khi Luật sư tiếp nhận yêu cầu (Khách hàng)
 */
const sendInquiryAcceptedEmail = async (email, fullName, lawyerName) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Luật sư đã tiếp nhận yêu cầu của bạn - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background-color: #041837; padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                        <h2 style="color: #f5b301; margin: 0; font-size: 20px;">TIẾP NHẬN THÀNH CÔNG</h2>
                    </div>
                    <div style="padding: 40px;">
                        <p>Xin chào <strong>${fullName}</strong>,</p>
                        <p style="line-height: 1.7; color: #475569;">Hệ thống Hiểu Luật xin thông báo: Yêu cầu tư vấn của bạn đã được <strong style="color: #041837;">Luật sư ${lawyerName}</strong> chính thức tiếp nhận.</p>
                        <div style="background-color: #f0f7ff; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; border: 1px solid #bae6fd;">
                            <span style="display: block; font-size: 12px; text-transform: uppercase; color: #0369a1; font-weight: 800; margin-bottom: 5px;">Luật sư phụ trách</span>
                            <span style="font-size: 20px; font-weight: 800; color: #0c4a6e;">${lawyerName}</span>
                        </div>
                        <p style="line-height: 1.7;">Vui lòng kiểm tra mục <b>Tin nhắn</b> trên website để trao đổi trực tiếp với Luật sư.</p>
                    </div>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryAcceptedEmail:', error);
    }
};

/**
 * Gửi email phản hồi tư vấn chính thức (Khách hàng)
 */
const sendInquiryResolvedEmail = async (email, fullName, lawyerName, reply) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Kết quả phản hồi tư vấn pháp lý - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">KẾT QUẢ TƯ VẤN</h1>
                    </div>
                    <div style="padding: 40px;">
                        <p>Xin chào <strong>${fullName}</strong>,</p>
                        <p>Luật sư <strong>${lawyerName}</strong> đã hoàn thành việc xem xét và đưa ra phản hồi chính thức cho vụ việc của bạn:</p>
                        <div style="background-color: #f0fdf4; border: 1px solid #10b981; padding: 30px; border-radius: 12px; margin: 25px 0;">
                            <p style="margin: 0 0 10px 0; font-weight: 800; color: #065f46; text-transform: uppercase; font-size: 13px;">Phản hồi từ Luật sư:</p>
                            <div style="line-height: 1.8; color: #1e293b; font-style: italic;">
                                ${reply}
                            </div>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">Mọi thắc mắc thêm bạn có thể trao đổi lại trong mục Tư vấn của tôi.</p>
                    </div>
                </div>
            `
        });
    } catch (error) {
        console.error('Error in sendInquiryResolvedEmail:', error);
    }
};

/**
 * Gửi email thương thảo mức phí (Gửi cho Luật sư hoặc Khách hàng)
 */
const sendNegotiationEmail = async (email, fullName, message) => {
    try {
        await sendMailInternal({
            to: email,
            subject: 'Yêu cầu thương thảo mức phí - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">YÊU CẦU THƯƠNG THẢO</h1>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 17px;">Xin chào <strong>${fullName}</strong>,</p>
                        <p style="line-height: 1.7; color: #475569;">Chúng tôi muốn trao đổi thêm về mức phí dịch vụ trên hệ thống. Dưới đây là nội dung đề xuất từ Ban điều hành:</p>
                        <div style="background-color: #fffbeb; border: 1px solid #f59e0b; padding: 30px; border-radius: 12px; margin: 25px 0;">
                            <div style="line-height: 1.8; color: #92400e; font-weight: 500;">
                                ${message}
                            </div>
                        </div>
                        <p style="font-size: 15px;">Vui lòng đăng nhập vào hệ thống để xác nhận hoặc phản hồi lại đề xuất này.</p>
                        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                            <p style="margin: 0; font-weight: 800; color: #041837;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                        </div>
                    </div>
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

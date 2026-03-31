const nodemailer = require('nodemailer');
require('dotenv').config();

const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const getEmailUser = () => (process.env.EMAIL_USER || '').trim();
const getEmailPass = () => (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const getEmailFrom = () => {
    const emailUser = getEmailUser();
    const configuredFrom = (process.env.EMAIL_FROM || '').trim();
    const smtpHost = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim().toLowerCase();

    if (smtpHost.includes('gmail.com')) {
        return emailUser;
    }

    return configuredFrom || emailUser;
};

/**
 * Tạo transporter cho email (sử dụng Gmail)
 */
const createTransporter = () => {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const isSecure = process.env.EMAIL_SECURE
        ? process.env.EMAIL_SECURE === 'true'
        : port === 465;

    console.log(`- Cấu hình SMTP: ${host}:${port} (Secure: ${isSecure})`);
    
    return nodemailer.createTransport({
        host: host,
        port: port,
        secure: isSecure,
        auth: {
            user: getEmailUser(),
            pass: getEmailPass()
        },
        connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) || 10000,
        greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) || 10000,
        socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT, 10) || 15000,
        tls: {
            rejectUnauthorized: false // Giúp tránh lỗi chứng chỉ trên một số server deploy
        }
    });
};

/**
 * Gửi email đặt lại mật khẩu
 */
const sendPasswordResetEmail = async (email, fullName, resetToken) => {
    try {
        if (!getEmailUser() || !getEmailPass()) {
            console.log('📧 [MOCK EMAIL] Password Reset Email:');
            console.log(`To: ${email}`);
            console.log(`Reset Link: ${getFrontendBaseUrl()}/reset-password?token=${resetToken}`);
            return;
        }

        const transporter = createTransporter();
        const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: `"Lawyer Platform" <${getEmailFrom()}>`,
            to: email,
            subject: 'Đặt lại mật khẩu - Lawyer Platform',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Đặt lại mật khẩu</h2>
                    <p>Xin chào <strong>${fullName}</strong>,</p>
                    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Vui lòng click vào link bên dưới để đặt lại mật khẩu:</p>
                    <p style="margin: 20px 0;">
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
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 12px;">
                        Email này được gửi tự động, vui lòng không trả lời.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email đã được gửi:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Lỗi gửi email:', error);
        throw error;
    }
};

/**
 * Gửi email xác thực tài khoản
 */
const sendVerifyEmail = async (email, fullName, verifyUrl) => {
    return new Promise((resolve) => {
        setImmediate(async () => {
            try {
                if (!getEmailUser() || !getEmailPass()) {
                    console.log('⚠️ [MOCK EMAIL] EMAIL_USER/PASS chưa được set. Verify link:', verifyUrl);
                    resolve({ sent: false, mocked: true, reason: 'missing_email_env' });
                    return;
                }

                const transporter = createTransporter();

                console.log(`📧 Đang gửi email xác thực đến: ${email}...`);

                const info = await transporter.sendMail({
                    from: `"Lawyer Platform" <${getEmailFrom()}>`,
                    to: email,
                    subject: 'Xác thực email tài khoản',
                    text: [
                        `Xin chào ${fullName},`,
                        '',
                        'Vui lòng truy cập link dưới đây để xác thực email tài khoản:',
                        verifyUrl,
                        '',
                        'Link có hiệu lực trong 24 giờ.'
                    ].join('\n'),
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
                            <p style="line-height: 1.6; color: #475569;">Nếu nút không hoạt động, hãy copy link này vào trình duyệt:</p>
                            <p style="word-break: break-all; color: #0f172a; font-size: 13px;">${verifyUrl}</p>
                            <p style="color: #94a3b8; font-size: 12px; font-style: italic;">Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.</p>
                        </div>
                    `
                });

                console.log('✅ Email xác thực đã được gửi thành công!', info.messageId);
                resolve({ sent: true, messageId: info.messageId });
            } catch (error) {
                console.error('❌ Lỗi SMTP nghiêm trọng:', error.code, error.message);
                // Đừng throw lỗi ở đây để không làm gián đoạn luồng chính của website
                resolve({
                    sent: false,
                    errorCode: error.code || 'UNKNOWN_EMAIL_ERROR',
                    errorMessage: error.message
                });
            }
        });
    });
};

/**
 * Gửi email xác nhận sau khi gửi yêu cầu tư vấn
 */
const sendInquiryConfirmationEmail = async (email, fullName) => {
    try {
        if (!getEmailUser() || !getEmailPass()) {
            console.log('📧 [MOCK EMAIL] Inquiry Confirmation:');
            console.log(`To: ${email}`);
            return;
        }

        const transporter = createTransporter();

        const mailOptions = {
            from: `"Hệ thống Hiểu Luật" <${getEmailFrom()}>`,
            to: email,
            subject: 'Xác nhận yêu cầu tư vấn - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #041837 0%, #0a2b57 100%); color: white; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Xác Nhận Yêu Cầu</h1>
                        <p style="margin-top: 10px; opacity: 0.8; font-size: 14px;">Hệ thống Hiểu Luật - Đồng hành cùng bạn</p>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 18px;">Xin chào <strong style="color: #f5b301;">${fullName}</strong>,</p>
                        <p>Chúng tôi đã nhận được yêu cầu tư vấn pháp lý của bạn qua website. Cảm ơn bạn đã tin tưởng và lựa chọn <strong>Hệ thống Hiểu Luật</strong>.</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #f5b301; padding: 20px; margin: 30px 0; border-radius: 8px;">
                            <p style="margin: 0; color: #64748b; font-style: italic;">
                                "Đội ngũ chuyên gia pháp lý của chúng tôi đang xem xét nội dung và sẽ chủ động liên hệ với bạn trong thời gian sớm nhất có thể."
                            </p>
                        </div>

                        <p style="margin-top: 40px; font-size: 14px; color: #64748b;">
                            Trong lúc chờ đợi, bạn có thể chuẩn bị sẵn các hồ sơ liên quan để cuộc tư vấn đạt hiệu quả cao nhất.
                        </p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        
                        <p style="margin: 0; font-weight: 700;">Trân trọng,</p>
                        <p style="margin: 5px 0 0 0; color: #041837; font-weight: 800;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0;">Đây là email tự động từ hệ thống, vui lòng không trả lời trực tiếp vào email này.</p>
                        <p style="margin: 5px 0 0 0;">© 2026 Lawyer Platform. Mọi quyền được bảo lưu.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email xác nhận yêu cầu đã được gửi:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Lỗi gửi email xác nhận yêu cầu:', error);
    }
};

/**
 * Gửi email khi luật sư tiếp nhận yêu cầu
 */
const sendInquiryAcceptedEmail = async (email, fullName, lawyerName) => {
    try {
        if (!getEmailUser() || !getEmailPass()) {
            console.log('📧 [MOCK EMAIL] Inquiry Accepted:');
            console.log(`To: ${email}, Lawyer: ${lawyerName}`);
            return;
        }

        const transporter = createTransporter();
        const mailOptions = {
            from: `"Hệ thống Hiểu Luật" <${getEmailFrom()}>`,
            to: email,
            subject: 'Yêu cầu tư vấn của bạn đã được luật sư tiếp nhận - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #041837 0%, #0a2b57 100%); color: white; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Luật Sư Đã Tiếp Nhận</h1>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 18px;">Xin chào <strong>${fullName}</strong>,</p>
                        <p>Hệ thống Hiểu Luật xin thông báo: Yêu cầu tư vấn của bạn đã được <strong style="color: #f5b301;">Luật sư ${lawyerName}</strong> tiếp nhận xử lý.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; margin: 30px 0; border-radius: 16px; text-align: center;">
                            <p style="margin: 0 0 10px 0; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #94a3b8;">Luật sư phụ trách của bạn</p>
                            <p style="margin: 0; font-size: 20px; font-weight: 800; color: #041837;">${lawyerName}</p>
                        </div>

                        <p>Luật sư sẽ sớm phản hồi nội dung tư vấn chi tiết cho bạn qua hệ thống hoặc liên hệ trực tiếp qua số điện thoại bạn cung cấp.</p>
                        <p>Bạn có thể đăng nhập vào Dashboard khách hàng để theo dõi tiến độ xử lý yêu cầu.</p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        <p style="margin: 0; font-weight: 700;">Trân trọng,</p>
                        <p style="margin: 5px 0 0 0; color: #041837; font-weight: 800;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('✅ Email tiếp nhận yêu cầu đã được gửi');
    } catch (error) {
        console.error('❌ Lỗi gửi email tiếp nhận:', error);
    }
};

/**
 * Gửi email khi yêu cầu tư vấn hoàn thành
 */
const sendInquiryResolvedEmail = async (email, fullName, lawyerName, reply) => {
    try {
        if (!getEmailUser() || !getEmailPass()) {
            console.log('📧 [MOCK EMAIL] Inquiry Resolved:');
            console.log(`To: ${email}, Reply: ${reply}`);
            return;
        }

        const transporter = createTransporter();
        const mailOptions = {
            from: `"Hệ thống Hiểu Luật" <${getEmailFrom()}>`,
            to: email,
            subject: 'Kết quả phản hồi tư vấn pháp lý - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Kết Quả Tư Vấn</h1>
                        <p style="margin-top: 10px; opacity: 0.8; font-size: 14px;">Luật sư ${lawyerName} đã phản hồi yêu cầu của bạn</p>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 18px;">Xin chào <strong>${fullName}</strong>,</p>
                        <p>Luật sư <strong style="color: #059669;">${lawyerName}</strong> đã hoàn thành việc xem xét và đưa ra phản hồi cho yêu cầu tư vấn của bạn.</p>
                        
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 25px; margin: 30px 0; border-radius: 16px;">
                            <p style="margin: 0 0 10px 0; font-weight: 800; color: #065f46; border-bottom: 2px solid #bbf7d0; padding-bottom: 5px; display: inline-block;">Nội dung phản hồi:</p>
                            <p style="margin: 10px 0 0 0; color: #1e293b; font-style: italic; white-space: pre-line;">
                                ${reply}
                            </p>
                        </div>

                        <p>Nếu có thắc mắc thêm về nội dung này, bạn vui lòng đăng nhập Dashboard để trao đổi hoặc liên hệ trực tiếp với chúng tôi qua hotline.</p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        <p style="margin: 0; font-weight: 700;">Trân trọng,</p>
                        <p style="margin: 5px 0 0 0; color: #041837; font-weight: 800;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('✅ Email hoàn thành đã được gửi');
    } catch (error) {
        console.error('❌ Lỗi gửi email hoàn thành:', error);
    }
};

/**
 * Gửi email thương thảo mức phí với Luật sư
 */
const sendNegotiationEmail = async (email, fullName, message) => {
    try {
        if (!getEmailUser() || !getEmailPass()) {
            console.log('📧 [MOCK EMAIL] Negotiation Email:');
            console.log(`To: ${email}, Message: ${message}`);
            return;
        }

        const transporter = createTransporter();
        const mailOptions = {
            from: `"Ban Điều Hành Hệ thống" <${getEmailFrom()}>`,
            to: email,
            subject: 'Yêu cầu thương thảo mức phí tư vấn - Hệ thống Hiểu Luật',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Yêu Cầu Thương Thảo</h1>
                        <p style="margin-top: 10px; opacity: 0.8; font-size: 14px;">Về mức phí tư vấn trên hệ thống</p>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 18px;">Xin chào Luật sư <strong>${fullName}</strong>,</p>
                        <p>Ban điều hành hệ thống đã xem xét hồ sơ đăng ký của bạn. Chúng tôi muốn trao đổi thêm về mức phí tư vấn bạn đã đề xuất.</p>
                        
                        <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 25px; margin: 30px 0; border-radius: 16px;">
                            <p style="margin: 0 0 10px 0; font-weight: 800; color: #92400e; border-bottom: 2px solid #fde68a; padding-bottom: 5px; display: inline-block;">Nội dung phản hồi từ Admin:</p>
                            <p style="margin: 10px 0 0 0; color: #1e293b; font-style: italic; white-space: pre-line;">
                                ${message}
                            </p>
                        </div>

                        <p>Vui lòng đăng nhập vào Dashboard Luật sư để cập nhật lại mức phí phù hợp hoặc liên hệ trực tiếp với chúng tôi để trao đổi thêm.</p>
                        <p>Hồ sơ của bạn sẽ được tiếp tục xét duyệt ngay sau khi mức phí được thống nhất.</p>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        <p style="margin: 0; font-weight: 700;">Trân trọng,</p>
                        <p style="margin: 5px 0 0 0; color: #041837; font-weight: 800;">Ban Điều Hành Hệ thống Hiểu Luật</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('✅ Email thương thảo đã được gửi');
    } catch (error) {
        console.error('❌ Lỗi gửi email thương thảo:', error);
    }
};

/**
 * Kiểm tra kết nối SMTP lúc khởi động
 */
const verifySmtpConnection = async () => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ SMTP: Kết nối email thành công!');
    } catch (error) {
        console.error('❌ SMTP: Kết nối email thất bại! Link xác thức có thể không gửi được.');
        console.error('   Mã lỗi:', error.code, '| Tin nhắn:', error.message);
        throw error;
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

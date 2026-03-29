const { Inquiry, User } = require('../models');
const { sendInquiryConfirmationEmail } = require('../utils/email');

// Create a new inquiry (Public)
const createInquiry = async (req, res) => {
    try {
        const { fullName, email, phone, content, lawyerId } = req.body;

        if (!fullName || !email || !phone || !content) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin: họ tên, email, số điện thoại và nội dung.'
            });
        }

        const inquiry = await Inquiry.create({
            full_name: fullName,
            email,
            phone,
            content,
            lawyer_id: lawyerId || null
        });

        // Gửi email cảm ơn tự động (không bắt buộc phải đợi xong mới trả về response)
        sendInquiryConfirmationEmail(email, fullName);

        res.status(201).json({
            success: true,
            message: 'Yêu cầu tư vấn của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ lại sớm nhất!',
            data: inquiry
        });
    } catch (error) {
        console.error('Error creating inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi gửi yêu cầu: ' + error.message,
            error: error.message
        });
    }
};

// Get all inquiries (Lawyer/Admin)
const getInquiries = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows } = await Inquiry.findAndCountAll({
            include: [
                {
                    model: User,
                    as: 'assigned_lawyer',
                    attributes: ['id', 'full_name', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            success: true,
            data: {
                inquiries: rows,
                pagination: {
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    page,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error fetching inquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu tư vấn.'
        });
    }
};

// Update inquiry status
const updateInquiryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lawyerId, lawyerReply } = req.body;

        const inquiry = await Inquiry.findByPk(id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu tư vấn.'
            });
        }

        const oldStatus = inquiry.status;

        await inquiry.update({
            status: status || inquiry.status,
            lawyer_id: lawyerId || inquiry.lawyer_id,
            lawyer_reply: lawyerReply !== undefined ? lawyerReply : inquiry.lawyer_reply
        });

        // Trigger notifications
        const { sendInquiryAcceptedEmail, sendInquiryResolvedEmail } = require('../utils/email');
        const updatedInquiry = await Inquiry.findByPk(id, {
            include: [{ model: User, as: 'assigned_lawyer', attributes: ['full_name'] }]
        });

        if (status === 'contacted' && oldStatus === 'pending') {
            // Send Email Accepted
            sendInquiryAcceptedEmail(inquiry.email, inquiry.full_name, updatedInquiry.assigned_lawyer?.full_name || 'Hệ thống');
        } else if (status === 'resolved' && (oldStatus === 'contacted' || oldStatus === 'pending')) {
            // Send Email Resolved
            sendInquiryResolvedEmail(inquiry.email, inquiry.full_name, updatedInquiry.assigned_lawyer?.full_name || 'Hệ thống', lawyerReply);
        }

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thành công.',
            data: updatedInquiry
        });
    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật yêu cầu.'
        });
    }
};

// Get inquiries for current logged in user (by email)
const getMyInquiries = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const inquiries = await Inquiry.findAll({
            where: { email: userEmail },
            include: [
                {
                    model: User,
                    as: 'assigned_lawyer',
                    attributes: ['id', 'full_name', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: { inquiries }
        });
    } catch (error) {
        console.error('Error fetching my inquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu của bạn.'
        });
    }
};

module.exports = {
    createInquiry,
    getInquiries,
    updateInquiryStatus,
    getMyInquiries
};

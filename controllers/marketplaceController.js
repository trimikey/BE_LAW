const { Case, CaseInterest, User, Lawyer } = require('../models');
const { Op } = require('sequelize');

// Lawyers: Xem danh sách cases đang mở (chưa có lawyer)
const getAvailableCases = async (req, res) => {
    try {
        const { search, caseType, priority, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = {
            lawyer_id: null, // Chỉ hiển thị cases chưa có lawyer
            status: { [Op.in]: ['pending', 'in_progress'] } // Chỉ cases đang mở
        };

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }
        if (caseType) where.case_type = caseType;
        if (priority) where.priority = priority;

        const { count, rows } = await Case.findAndCountAll({
            where,
            include: [
                { 
                    model: User, 
                    as: 'client',
                    attributes: ['id', 'full_name', 'email']
                },
                {
                    model: CaseInterest,
                    as: 'interests',
                    attributes: ['id', 'lawyer_id', 'status'],
                    include: [{
                        model: User,
                        as: 'lawyer',
                        attributes: ['id', 'full_name']
                    }]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        // Kiểm tra lawyer đã quan tâm case nào chưa
        const lawyerId = req.user.id;
        const casesWithInterest = rows.map(caseItem => {
            const caseData = caseItem.toJSON();
            const hasInterest = caseData.interests.some(
                interest => interest.lawyer_id === lawyerId && interest.status === 'pending'
            );
            return {
                ...caseData,
                hasInterest,
                interestCount: caseData.interests.length
            };
        });

        res.json({
            success: true,
            data: {
                cases: casesWithInterest,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting available cases:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách vụ việc'
        });
    }
};

// Lawyer: Gửi interest đến case
const expressInterest = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { message, proposedFee, estimatedDuration } = req.body;
        const lawyerId = req.user.id;

        // Kiểm tra case tồn tại và chưa có lawyer
        const caseRecord = await Case.findOne({
            where: { id: caseId }
        });

        if (!caseRecord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vụ việc'
            });
        }

        if (caseRecord.lawyer_id) {
            return res.status(400).json({
                success: false,
                message: 'Vụ việc này đã có luật sư được gán'
            });
        }

        // Kiểm tra đã quan tâm chưa
        const existingInterest = await CaseInterest.findOne({
            where: {
                case_id: caseId,
                lawyer_id: lawyerId,
                status: { [Op.in]: ['pending', 'accepted'] }
            }
        });

        if (existingInterest) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã quan tâm vụ việc này rồi'
            });
        }

        // Tạo interest
        const interest = await CaseInterest.create({
            case_id: caseId,
            lawyer_id: lawyerId,
            message: message || null,
            proposed_fee: proposedFee || null,
            estimated_duration: estimatedDuration || null,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Đã gửi quan tâm đến vụ việc thành công',
            data: { interest }
        });
    } catch (error) {
        console.error('Error expressing interest:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi quan tâm'
        });
    }
};

// Lawyer: Rút lại interest
const withdrawInterest = async (req, res) => {
    try {
        const { caseId } = req.params;
        const lawyerId = req.user.id;

        const interest = await CaseInterest.findOne({
            where: {
                case_id: caseId,
                lawyer_id: lawyerId,
                status: 'pending'
            }
        });

        if (!interest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quan tâm này'
            });
        }

        await interest.update({ status: 'withdrawn' });

        res.json({
            success: true,
            message: 'Đã rút lại quan tâm'
        });
    } catch (error) {
        console.error('Error withdrawing interest:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi rút lại quan tâm'
        });
    }
};

// Client: Xem danh sách lawyers đã quan tâm case
const getCaseInterests = async (req, res) => {
    try {
        const { caseId } = req.params;
        const clientId = req.user.id;

        // Kiểm tra case thuộc về client
        const caseRecord = await Case.findOne({
            where: { id: caseId, client_id: clientId }
        });

        if (!caseRecord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vụ việc hoặc không có quyền truy cập'
            });
        }

        const interests = await CaseInterest.findAll({
            where: {
                case_id: caseId,
                status: { [Op.in]: ['pending', 'accepted'] }
            },
            include: [
                {
                    model: User,
                    as: 'lawyer',
                    attributes: ['id', 'full_name', 'email', 'phone'],
                    include: [{
                        model: Lawyer,
                        as: 'lawyer',
                        attributes: [
                            'law_firm',
                            'specialties',
                            'years_of_experience',
                            'bio',
                            'verification_status'
                        ]
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Đánh dấu đã xem
        await CaseInterest.update(
            { client_viewed: true, viewed_at: new Date() },
            {
                where: {
                    case_id: caseId,
                    client_viewed: false
                }
            }
        );

        res.json({
            success: true,
            data: { interests }
        });
    } catch (error) {
        console.error('Error getting case interests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách luật sư quan tâm'
        });
    }
};

// Client: Chọn lawyer từ danh sách interested
const selectLawyer = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { interestId } = req.body;
        const clientId = req.user.id;

        // Kiểm tra case thuộc về client
        const caseRecord = await Case.findOne({
            where: { id: caseId, client_id: clientId }
        });

        if (!caseRecord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vụ việc hoặc không có quyền'
            });
        }

        if (caseRecord.lawyer_id) {
            return res.status(400).json({
                success: false,
                message: 'Vụ việc này đã có luật sư được gán'
            });
        }

        // Kiểm tra interest tồn tại và thuộc về case này
        const interest = await CaseInterest.findOne({
            where: {
                id: interestId,
                case_id: caseId,
                status: 'pending'
            }
        });

        if (!interest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quan tâm này hoặc đã được xử lý'
            });
        }

        // Cập nhật case: gán lawyer
        await caseRecord.update({ lawyer_id: interest.lawyer_id });

        // Cập nhật interest: accepted
        await interest.update({ status: 'accepted' });

        // Reject tất cả các interests khác
        await CaseInterest.update(
            { status: 'rejected' },
            {
                where: {
                    case_id: caseId,
                    id: { [Op.ne]: interestId },
                    status: 'pending'
                }
            }
        );

        res.json({
            success: true,
            message: 'Đã chọn luật sư thành công',
            data: { case: caseRecord, interest }
        });
    } catch (error) {
        console.error('Error selecting lawyer:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi chọn luật sư'
        });
    }
};

// Lawyer: Xem các cases đã quan tâm
const getMyInterests = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = { lawyer_id: lawyerId };
        if (status) where.status = status;

        const { count, rows } = await CaseInterest.findAndCountAll({
            where,
            include: [
                {
                    model: Case,
                    as: 'case',
                    attributes: ['id', 'title', 'description', 'case_type', 'status', 'priority'],
                    include: [{
                        model: User,
                        as: 'client',
                        attributes: ['id', 'full_name', 'email']
                    }]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                interests: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting my interests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách quan tâm'
        });
    }
};

module.exports = {
    getAvailableCases,
    expressInterest,
    withdrawInterest,
    getCaseInterests,
    selectLawyer,
    getMyInterests
};

const { Case, CaseStep, Document, User, Lawyer, Role, Payment } = require('../models');
const { createPayOSLink, getPayOSPaymentStatus } = require('../services/payos.service');
const { Op } = require('sequelize');

// Lấy chi tiết case với steps và documents
const getCaseById = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        // Lấy role name từ database
        const user = await User.findByPk(userId, {
            attributes: ['id', 'role_id']
        });

        if (!user || !user.role_id) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const role = await Role.findByPk(user.role_id, {
            attributes: ['name']
        });

        if (!role) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const userRole = role.name;

        // Kiểm tra quyền truy cập
        const caseRecord = await Case.findOne({
            where: { id: caseId },
            include: [
                { model: User, as: 'client', attributes: ['id', 'full_name', 'email'] },
                {
                    model: User,
                    as: 'lawyer',
                    attributes: ['id', 'full_name', 'email'],
                    include: [{ model: Lawyer, as: 'lawyer', attributes: ['law_firm', 'specialties'] }]
                }
            ]
        });

        if (!caseRecord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vụ việc'
            });
        }

        // Kiểm tra quyền: client chỉ xem case của mình, lawyer chỉ xem case được gán
        if (userRole === 'client' && caseRecord.client_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập vụ việc này'
            });
        }

        if (userRole === 'lawyer' && caseRecord.lawyer_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập vụ việc này'
            });
        }

        // Lấy steps
        const steps = await CaseStep.findAll({
            where: {
                case_id: caseId,
                ...(userRole === 'client' ? { client_visible: true } : {})
            },
            include: [
                {
                    model: User,
                    as: 'assignedUser',
                    attributes: ['id', 'full_name', 'email']
                },
                {
                    model: Document,
                    as: 'stepDocuments',
                    include: [{ model: User, as: 'uploader', attributes: ['id', 'full_name'] }]
                }
            ],
            order: [['step_order', 'ASC']]
        });

        // Lấy documents
        const documents = await Document.findAll({
            where: { case_id: caseId },
            include: [
                {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'full_name', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Tính progress và tài chính
        const totalSteps = steps.length;
        const completedSteps = steps.filter(s => s.status === 'completed').length;
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        const totalPaid = steps
            .filter(s => s.payment_status === 'paid')
            .reduce((sum, s) => sum + Number(s.fee_amount || 0), 0);

        const totalEstimatedFee = steps
            .reduce((sum, s) => sum + Number(s.fee_amount || 0), 0);

        res.json({
            success: true,
            data: {
                case: caseRecord,
                steps,
                documents,
                progress: {
                    total: totalSteps,
                    completed: completedSteps,
                    percentage: progress
                },
                finance: {
                    totalPaid,
                    totalEstimatedFee,
                    budget: caseRecord.estimated_fee
                }
            }
        });

    } catch (error) {
        console.error('Error getting case:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin vụ việc'
        });
    }
};

// Tạo steps mặc định cho case
const initializeCaseSteps = async (caseId, caseType = 'consultation') => {
    const defaultSteps = [
        { step_name: 'INTAKE', step_order: 1, description: 'Thu thập thông tin và tiếp nhận vụ việc ban đầu' },
        { step_name: 'DOCUMENT REVIEW', step_order: 2, description: 'Rà soát tài liệu và kiểm tra bằng chứng hồ sơ' },
        { step_name: 'ASSESSMENT', step_order: 3, description: 'Đánh giá pháp lý và phân tích rủi ro tiềm ẩn' },
        { step_name: 'PREPARATION', step_order: 4, description: 'Chuẩn bị tài liệu pháp lý và phương án xử lý' },
        { step_name: 'SUBMISSION', step_order: 5, description: 'Nộp hồ sơ và làm việc với cơ quan nhà nước' },
        { step_name: 'FOLLOW-UP', step_order: 6, description: 'Theo dõi hoàn tất nghĩa vụ và khắc phục hệ thống' }
    ];

    const steps = defaultSteps.map(step => ({
        ...step,
        case_id: caseId,
        status: step.step_order === 1 ? 'in_progress' : 'pending',
        client_visible: true
    }));

    await CaseStep.bulkCreate(steps);
    return steps;
};

// Cập nhật step status
const updateStepStatus = async (req, res) => {
    try {
        const { caseId, stepId } = req.params;
        const { status, notes, dueDate, feeAmount, description } = req.body;
        const userId = req.user.id;

        const step = await CaseStep.findOne({
            where: { id: stepId, case_id: caseId },
            include: [{ model: Case, as: 'case' }]
        });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bước này'
            });
        }

        // Lấy role name từ database
        const user = await User.findByPk(userId, {
            attributes: ['id', 'role_id']
        });

        if (!user || !user.role_id) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const role = await Role.findByPk(user.role_id, {
            attributes: ['name']
        });

        if (!role) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const userRole = role.name;

        if (userRole === 'client' && step.case.client_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền cập nhật bước này'
            });
        }

        // Cập nhật status
        const updateData = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (description !== undefined) updateData.description = description;
        if (dueDate) updateData.due_date = dueDate;

        // Kiểm tra giới hạn thay đổi phí (tối đa 3 lần)
        if (feeAmount !== undefined && Number(feeAmount) !== Number(step.fee_amount)) {
            if (step.fee_change_count >= 3) {
                return res.status(400).json({
                    success: false,
                    message: `Bạn đã thay đổi phí giai đoạn này quá 3 lần. Không thể thay đổi thêm.`
                });
            }
            updateData.fee_amount = feeAmount;
            updateData.fee_change_count = step.fee_change_count + 1;
        }

        // Tự động set started_at và completed_at
        if (status === 'in_progress' && !step.started_at) {
            updateData.started_at = new Date();
        }
        if (status === 'completed') {
            // Kiểm tra ràng buộc thanh toán nếu là chế độ trả theo giai đoạn
            if (step.case.payment_mode === 'step_by_step' && step.payment_status !== 'paid' && step.fee_amount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Giai đoạn "${step.step_name}" chưa được thanh toán. Vui lòng thanh toán ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(step.fee_amount)} để có thể hoàn thành và chuyển sang bước tiếp theo.`
                });
            }

            if (!step.completed_at) {
                updateData.completed_at = new Date();
            }
        }

        await step.update(updateData);

        try {
            const ns = require("../services/notification.service");
            const cr = await step.getCase();
            if (cr) await ns.notifyCaseUpdate(cr, "Cập nhật tiến độ", "Giai đoạn " + step.step_name + " đã cập nhật");
        } catch (e) { }

        // Nếu step hoàn thành, tự động chuyển step tiếp theo sang in_progress
        if (status === 'completed') {
            const nextStep = await CaseStep.findOne({
                where: {
                    case_id: caseId,
                    step_order: step.step_order + 1,
                    status: 'pending'
                }
            });

            if (nextStep) {
                await nextStep.update({
                    status: 'in_progress',
                    started_at: new Date()
                });
            }
        }
        await step.reload({
            include: [{ model: User, as: 'assignedUser', attributes: ['id', 'full_name', 'email'] }]
        });

        res.json({
            success: true,
            message: 'Cập nhật bước thành công',
            data: { step }
        });

    } catch (error) {
        console.error('Error updating step:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật bước'
        });
    }
};

// Gán step cho user
const assignStep = async (req, res) => {
    try {
        const { caseId, stepId } = req.params;
        const { assignedTo } = req.body;

        const step = await CaseStep.findOne({
            where: { id: stepId, case_id: caseId }
        });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bước này'
            });
        }

        await step.update({ assigned_to: assignedTo });

        res.json({
            success: true,
            message: 'Gán bước thành công',
            data: { step }
        });

    } catch (error) {
        console.error('Error assigning step:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gán bước'
        });
    }
};

// Cập nhật trạng thái thanh toán của step (dành cho lawyer/admin hoặc hệ thống)
const updateStepPaymentStatus = async (req, res) => {
    try {
        const { caseId, stepId } = req.params;
        const { paymentStatus } = req.body;

        if (stepId === 'all') {
            await CaseStep.update(
                { payment_status: paymentStatus },
                { where: { case_id: caseId } }
            );

            return res.json({
                success: true,
                message: 'Đã cập nhật trạng thái thanh toán cho tất cả các giai đoạn'
            });
        }

        const step = await CaseStep.findOne({
            where: { id: stepId, case_id: caseId }
        });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bước này'
            });
        }

        await step.update({ payment_status: paymentStatus });

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thanh toán thành công',
            data: { step }
        });

    } catch (error) {
        console.error('Error updating step payment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái thanh toán'
        });
    }
};

const getStepPaymentLink = async (req, res) => {
    try {
        const { caseId, stepId } = req.params;
        const userId = req.user.id;

        const caseRecord = await Case.findByPk(caseId);
        if (!caseRecord) return res.status(404).json({ success: false, message: 'Không tìm thấy vụ việc' });

        let amount = 0;
        let description = '';
        let orderCode = Number(Date.now().toString().slice(-9) + Math.floor(Math.random() * 100).toString().padStart(2, '0'));

        if (stepId === 'all') {
            const steps = await CaseStep.findAll({ where: { case_id: caseId, payment_status: 'unpaid' } });
            amount = steps.reduce((sum, s) => sum + Number(s.fee_amount), 0);
            description = `Case ${caseId} Tran goi`.slice(0, 25);
        } else {
            const step = await CaseStep.findOne({ where: { id: stepId, case_id: caseId } });
            if (!step) return res.status(404).json({ success: false, message: 'Không tìm thấy giai đoạn' });
            amount = Number(step.fee_amount);
            description = `Case ${caseId} GD ${step.step_order}`.slice(0, 25);
        }

        if (amount <= 0) return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0' });

        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const mobileQuery = req.body.isMobile
            ? `?mobile=true&type=case&caseId=${encodeURIComponent(caseId)}${stepId ? `&stepId=${encodeURIComponent(stepId)}` : ''}`
            : '';
        const mobileCancelQuery = req.body.isMobile
            ? `?cancel=true&mobile=true&type=case&caseId=${encodeURIComponent(caseId)}${stepId ? `&stepId=${encodeURIComponent(stepId)}` : ''}`
            : '?cancel=true';

        const payos = await createPayOSLink({
            amount,
            description,
            orderCode,
            returnUrl: `${frontendUrl}/payment/payos-return${mobileQuery}`,
            cancelUrl: `${frontendUrl}/payment/payos-return${mobileCancelQuery}`
        });

        await Payment.create({
            user_id: userId,
            case_id: caseId,
            amount,
            payment_type: 'case_fee',
            payment_method: 'payos',
            status: 'pending',
            transaction_id: String(orderCode),
            notes: JSON.stringify({ stepId, caseId })
        });

        res.json({ success: true, data: payos });

    } catch (error) {
        console.error('Error creating payment link:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const verifyStepPayment = async (req, res) => {
    try {
        const { orderCode } = req.params;
        const payosData = await getPayOSPaymentStatus(orderCode);

        const payment = await Payment.findOne({ where: { transaction_id: String(orderCode) } });
        if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

        if (payosData.status === 'PAID') {
            const notes = JSON.parse(payment.notes || '{}');

            if (payment.status !== 'completed') {
                await payment.update({ status: 'completed', payment_date: new Date() });

                // Cập nhật trạng thái cho step
                if (notes.stepId === 'all') {
                    await CaseStep.update(
                        { payment_status: 'paid' },
                        { where: { case_id: notes.caseId } }
                    );
                } else {
                    await CaseStep.update(
                        { payment_status: 'paid' },
                        { where: { id: notes.stepId, case_id: notes.caseId } }
                    );
                }
            }

            return res.json({ success: true, message: 'Thanh toán thành công' });
        }

        res.json({ success: false, message: 'Giao dịch chưa hoàn tất', status: payosData.status });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateStepResponse = async (req, res) => {
    try {
        const { caseId, stepId } = req.params;
        const { clientResponse, clientData } = req.body;
        const userId = req.user.id;

        const caseRecord = await Case.findByPk(caseId);
        if (!caseRecord) return res.status(404).json({ success: false, message: 'Không tìm thấy vụ việc' });

        if (caseRecord.client_id !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này' });
        }

        const step = await CaseStep.findOne({ where: { id: stepId, case_id: caseId } });
        if (!step) return res.status(404).json({ success: false, message: 'Không tìm thấy giai đoạn' });

        await step.update({
            client_response: clientResponse,
            client_data: clientData
        });

        res.json({ success: true, message: 'Đã cập nhật phản hồi', data: step });

    } catch (error) {
        console.error('Error updating step response:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCaseById,
    initializeCaseSteps,
    updateStepStatus,
    assignStep,
    updateStepPaymentStatus,
    updateStepResponse,
    getStepPaymentLink,
    verifyStepPayment
};

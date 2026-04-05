const { Case, Consultation, User, Lawyer, LawyerAvailability, LawyerReview, Payment, sequelize } = require('../models');
const reviewService = require('../services/review.service');
const { Op } = require('sequelize');
const { initializeCaseSteps } = require('./caseController');

const getDashboardStats = async (req, res) => {
  try {
    const clientId = req.user.id;

    const totalCases = await Case.count({ where: { client_id: clientId } });
    const activeCases = await Case.count({
      where: {
        client_id: clientId,
        status: { [Op.in]: ['pending', 'in_progress'] }
      }
    });
    const upcomingConsultations = await Consultation.count({
      where: {
        client_id: clientId,
        status: { [Op.in]: ['pending', 'confirmed'] },
        scheduled_at: { [Op.gte]: new Date() }
      }
    });
    const overdueConsultations = await Consultation.count({
      where: {
        client_id: clientId,
        status: 'confirmed',
        scheduled_at: { [Op.lt]: new Date() }
      }
    });

    res.json({
      success: true,
      data: {
        cases: { total: totalCases, active: activeCases },
        consultations: { upcoming: upcomingConsultations, overdue: overdueConsultations }
      }
    });
  } catch (error) {
    console.error('Error getting client stats:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay thong ke' });
  }
};

const getMyCases = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = { client_id: clientId };
    if (status) where.status = status;

    const { count, rows } = await Case.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'lawyer',
          attributes: ['id', 'full_name', 'email'],
          include: [{ model: Lawyer, as: 'lawyer', attributes: ['law_firm', 'specialties'] }]
        }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        cases: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting cases:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay danh sach vu viec' });
  }
};

const createCase = async (req, res) => {
  try {
    const { title, description, caseType, priority, estimatedFee } = req.body;
    const normalizedEstimatedFee =
      estimatedFee === undefined || estimatedFee === null || estimatedFee === ''
        ? null
        : Number(estimatedFee);

    const caseRecord = await Case.create({
      client_id: req.user.id,
      title,
      description,
      case_type: caseType || 'consultation',
      priority: priority || 'medium',
      estimated_fee: normalizedEstimatedFee,
      status: 'pending'
    });

    await initializeCaseSteps(caseRecord.id, caseType || 'consultation');

    res.status(201).json({
      success: true,
      message: 'Tao vu viec thanh cong',
      data: { case: caseRecord }
    });
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ success: false, message: 'Loi khi tao vu viec' });
  }
};

const getMyConsultations = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = { client_id: clientId };
    if (status) where.status = status;

    const { count, rows } = await Consultation.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'lawyer',
          attributes: ['id', 'full_name', 'email'],
          include: [{ model: Lawyer, as: 'lawyer', attributes: ['law_firm', 'specialties'] }]
        },
        { model: Case, as: 'case', attributes: ['id', 'title'] }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['scheduled_at', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        consultations: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting consultations:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay lich tu van' });
  }
};

const searchLawyers = async (req, res) => {
  try {
    const { search, specialty, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    const lawyerWhere = { verification_status: 'verified' };

    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    if (specialty) {
      lawyerWhere.specialties = { [Op.like]: `%${specialty}%` };
    }

    const { count, rows } = await User.findAndCountAll({
      where: {
        ...where,
        role_id: 2
      },
      include: [
        { model: Lawyer, as: 'lawyer', where: lawyerWhere, required: true }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        lawyers: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error searching lawyers:', error);
    res.status(500).json({ success: false, message: 'Loi khi tim kiem luat su' });
  }
};

const bookConsultation = async (req, res) => {
  try {
    const { lawyerId, scheduledAt, duration, consultationType, caseId, fee } = req.body;
    const normalizedFee = fee === undefined || fee === null || fee === '' ? null : Number(fee);

    const lawyer = await Lawyer.findOne({
      where: { user_id: lawyerId, verification_status: 'verified' },
      include: [{ model: User, as: 'user' }]
    });

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Khong tim thay luat su hoac luat su chua duoc xac thuc'
      });
    }

    const consultation = await Consultation.create({
      client_id: req.user.id,
      lawyer_id: lawyerId,
      case_id: caseId || null,
      scheduled_at: scheduledAt,
      duration: duration || 60,
      consultation_type: consultationType || 'video',
      status: 'pending',
      fee: normalizedFee
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        consultationId: consultation.id,
        status: consultation.status,
        scheduledAt: consultation.scheduled_at
      };
      io.to(String(lawyerId)).emit('consultation_updated', payload);
      io.to(String(req.user.id)).emit('consultation_updated', payload);
    }

    res.status(201).json({
      success: true,
      message: 'Dat lich tu van thanh cong',
      data: { consultation }
    });
  } catch (error) {
    console.error('Error booking consultation:', error);
    res.status(500).json({ success: false, message: 'Loi khi dat lich tu van' });
  }
};

const getLawyerAvailability = async (req, res) => {
  try {
    const id = Number(req.params.lawyerId);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Lawyer id khong hop le' });
    }

    // Resolve the actual lawyer_id (User ID) used in LawyerAvailability table
    // because mobile might send Lawyer table PK id
    const lawyer = await Lawyer.findByPk(id);
    const userId = lawyer ? lawyer.user_id : id;

    const slots = await LawyerAvailability.findAll({
      where: {
        lawyer_id: userId,
        status: 'available',
        start_time: { [Op.gte]: new Date() }
      },
      order: [['start_time', 'ASC']],
      limit: 200
    });

    res.json({ success: true, data: slots });
  } catch (error) {
    console.error('Error getting lawyer availability:', error);
    res.status(500).json({ success: false, message: 'Loi lay lich trong luat su' });
  }
};

const bookConsultationFromSlot = async (req, res) => {
  let transaction;
  try {
    const { slotId, caseId } = req.body;
    if (!slotId) {
      return res.status(400).json({ success: false, message: 'Thieu slotId' });
    }

    transaction = await sequelize.transaction();

    const slot = await LawyerAvailability.findOne({
      where: { id: slotId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!slot || slot.status !== 'available') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Khung gio nay da duoc dat' });
    }

    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);

    if (start <= new Date()) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Khong the dat khung gio da qua' });
    }

    const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

    const consultation = await Consultation.create({
      client_id: req.user.id,
      lawyer_id: slot.lawyer_id,
      case_id: caseId || null,
      scheduled_at: start,
      duration,
      consultation_type: slot.consultation_type || 'video',
      status: 'pending',
      fee: null
    }, { transaction });

    await slot.update({
      status: 'booked',
      booked_by_client_id: req.user.id,
      booked_consultation_id: consultation.id
    }, { transaction });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      const payload = {
        consultationId: consultation.id,
        status: consultation.status,
        scheduledAt: consultation.scheduled_at
      };
      io.to(String(slot.lawyer_id)).emit('consultation_updated', payload);
      io.to(String(req.user.id)).emit('consultation_updated', payload);
      io.to(String(slot.lawyer_id)).emit('availability_updated', { lawyerId: slot.lawyer_id });
      io.to(String(req.user.id)).emit('availability_updated', { lawyerId: slot.lawyer_id });
    }

    return res.status(201).json({
      success: true,
      message: 'Dat lich tu slot thanh cong',
      data: { consultation, slot }
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error('Error booking consultation from slot:', error);
    return res.status(500).json({ success: false, message: 'Loi dat lich tu slot' });
  }
};

const updateCaseIntake = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { intakeData } = req.body;
    const clientId = req.user.id;

    const caseRecord = await Case.findOne({
      where: { id: caseId, client_id: clientId }
    });

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vụ việc'
      });
    }

    await caseRecord.update({ intake_data: intakeData });

    res.json({
      success: true,
      message: 'Cập nhật thông tin Intake thành công',
      data: { case: caseRecord }
    });
  } catch (error) {
    console.error('Error updating case intake:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin' });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'full_name', 'phone', 'avatar']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Error getting my profile:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin hồ sơ' });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const userUpdate = {};
    if (fullName) userUpdate.full_name = fullName;
    if (phone) userUpdate.phone = phone;
    if (req.file) {
      userUpdate.avatar = req.file.path;
    }

    await user.update(userUpdate);

    res.json({
      success: true,
      message: 'Cập nhật hồ sơ thành công',
      data: { user }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ' });
  }
};

const createReview = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { rating, comment } = req.body;
    const clientId = req.user.id;

    const lawyer = await Lawyer.findByPk(lawyerId);
    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy luật sư' });
    }
    const lawyerUserId = lawyer.user_id;

    // Use findOrCreate or manual logic to allow updating
    let review = await LawyerReview.findOne({
      where: { lawyer_id: lawyerUserId, client_id: clientId }
    });

    if (review) {
      // Update existing
      review.rating = rating || 5;
      review.comment = comment;
      await review.save();
    } else {
      // Create new
      review = await LawyerReview.create({
        lawyer_id: lawyerUserId,
        client_id: clientId,
        rating: rating || 5,
        comment,
        is_hidden: false
      });
    }

    // Refresh lawyer rating stats
    await reviewService.refreshLawyerRating(lawyerUserId);

    const fullReview = await LawyerReview.findByPk(review.id, {
      include: [{ model: User, as: 'clientUser', attributes: ['id', 'full_name', 'avatar'] }]
    });

    res.status(review.isNewRecord ? 201 : 200).json({
      success: true,
      message: 'Cập nhật đánh giá thành công',
      data: fullReview
    });
  } catch (error) {
    console.error('Error creating/updating review:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi đánh giá' });
  }
};

const getMyTransactions = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Payment.findAndCountAll({
      where: { user_id: clientId },
      include: [
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'title']
        },
        {
          model: Consultation,
          as: 'consultation',
          attributes: ['id', 'scheduled_at'],
          include: [{ model: User, as: 'lawyer', attributes: ['id', 'full_name'] }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting my transactions:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay lich su giao dich' });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const clientId = req.user.id;
    const reviews = await LawyerReview.findAll({
      where: { client_id: clientId },
      include: [
        {
          model: User,
          as: 'lawyerUser',
          attributes: ['id', 'full_name', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: { reviews }
    });
  } catch (error) {
    console.error('Error getting my reviews:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách đánh giá' });
  }
};

const deleteCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseRecord = await Case.findOne({
      where: { id: caseId, client_id: clientId }
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vụ việc' });
    }

    // Protection: only allow deletion if pending/rejected
    if (!['pending', 'rejected'].includes(caseRecord.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xóa vụ việc đang chờ hoặc bị từ chối'
      });
    }

    // Protection: check for payments
    const paymentsCount = await Payment.count({ where: { case_id: caseId } });
    if (paymentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa vụ việc đã có giao dịch thanh toán'
      });
    }

    await caseRecord.destroy();

    res.json({ success: true, message: 'Xóa vụ việc thành công' });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa vụ việc' });
  }
};

// @desc    Archive a case
// @route   PATCH /api/client/cases/:caseId/archive
// @access  Private (Client only)
exports.archiveCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseRecord = await Case.findOne({
      where: { id: caseId, client_id: clientId }
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vụ việc' });
    }

    caseRecord.archived_at = new Date();
    await caseRecord.save();

    res.status(200).json({
      success: true,
      message: 'Đã đưa vụ việc vào kho lưu trữ. Vụ việc sẽ bị xóa vĩnh viễn sau 7 ngày.'
    });
  } catch (error) {
    console.error('Archive case error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lưu trữ vụ việc' });
  }
};

// @desc    Restore an archived case
// @route   PATCH /api/client/cases/:caseId/restore
// @access  Private (Client only)
exports.restoreCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseRecord = await Case.findOne({
      where: { id: caseId, client_id: clientId }
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vụ việc' });
    }

    caseRecord.archived_at = null;
    await caseRecord.save();

    res.status(200).json({
      success: true,
      message: 'Đã khôi phục vụ việc thành công'
    });
  } catch (error) {
    console.error('Restore case error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi khôi phục vụ việc' });
  }
};


module.exports = {
  getDashboardStats,
  getMyCases,
  createCase,
  getMyConsultations,
  searchLawyers,
  bookConsultation,
  getLawyerAvailability,
  bookConsultationFromSlot,
  updateCaseIntake,
  getMyProfile,
  updateMyProfile,
  createReview,
  getMyTransactions,
  getMyReviews,
  deleteCase,
  archiveCase: exports.archiveCase,
  restoreCase: exports.restoreCase
};

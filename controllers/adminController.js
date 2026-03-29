const { User, Role, Lawyer, Case, Consultation, Payment, LawyerReview, Payout, sequelize } = require('../models');
const { Op } = require('sequelize');
const { sendNegotiationEmail } = require('../utils/email');

// ... existing code (I'll use multi_replace for better precision if needed, but let's try a clean replacement of the whole bottom section)
// Actually I'll just add the functions and update the export list.

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const totalUsers = await User.count();
    const totalLawyers = await User.count({
      where: { role_id: 2 },
      include: [{ model: Role, as: 'role', where: { name: 'lawyer' } }]
    });
    const totalClients = await User.count({
      where: { role_id: 3 },
      include: [{ model: Role, as: 'role', where: { name: 'client' } }]
    });
    const pendingLawyers = await Lawyer.count({ where: { verification_status: 'pending' } });

    const totalCases = await Case.count();
    const activeCases = await Case.count({ where: { status: { [Op.in]: ['pending', 'in_progress'] } } });
    const totalConsultations = await Consultation.count();

    const totalTransactions = await Payment.count();
    const completedTransactions = await Payment.count({ where: { status: 'completed' } });

    const totalGrossRevenue = await Payment.sum('amount', {
      where: {
        status: 'completed',
        payment_type: { [Op.ne]: 'refund' }
      }
    }) || 0;
    const monthlyGrossRevenue = await Payment.sum('amount', {
      where: {
        status: 'completed',
        payment_type: { [Op.ne]: 'refund' },
        created_at: { [Op.gte]: monthStart }
      }
    }) || 0;

    const adminEarnings = totalGrossRevenue * 0.15;
    const monthlyAdminEarnings = monthlyGrossRevenue * 0.15;

    const totalReviews = await LawyerReview.count();
    const totalIssues = await Case.count({ where: { status: { [Op.in]: ['cancelled', 'reviewing'] } } });

    const revenueByMonthRaw = await Payment.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: {
        status: 'completed',
        payment_type: { [Op.ne]: 'refund' },
        created_at: { [Op.gte]: sixMonthsAgo }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m')],
      order: [[sequelize.literal('month'), 'ASC']]
    });

    const casesByMonthRaw = await Case.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      where: {
        created_at: { [Op.gte]: sixMonthsAgo }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m')],
      order: [[sequelize.literal('month'), 'ASC']]
    });

    const consultationsByMonthRaw = await Consultation.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      where: {
        created_at: { [Op.gte]: sixMonthsAgo }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m')],
      order: [[sequelize.literal('month'), 'ASC']]
    });

    const usersByMonthRaw = await User.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      where: {
        created_at: { [Op.gte]: sixMonthsAgo }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m')],
      order: [[sequelize.literal('month'), 'ASC']]
    });

    const monthLabels = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const revenueMap = new Map(revenueByMonthRaw.map((item) => [item.get('month'), Number(item.get('total') || 0)]));
    const usersMap = new Map(usersByMonthRaw.map((item) => [item.get('month'), Number(item.get('total') || 0)]));
    const casesMap = new Map(casesByMonthRaw.map((item) => [item.get('month'), Number(item.get('total') || 0)]));
    const consultationsMap = new Map(consultationsByMonthRaw.map((item) => [item.get('month'), Number(item.get('total') || 0)]));

    const chart = monthLabels.map((month) => {
      const gross = revenueMap.get(month) || 0;
      return {
        month,
        revenue: gross,
        adminRevenue: gross * 0.15,
        users: usersMap.get(month) || 0,
        cases: casesMap.get(month) || 0,
        consultations: consultationsMap.get(month) || 0
      };
    });

    const recentTransactions = await Payment.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          lawyers: totalLawyers,
          clients: totalClients,
          pendingLawyers
        },
        cases: {
          total: totalCases,
          active: activeCases
        },
        consultations: {
          total: totalConsultations
        },
        revenue: {
          total: totalGrossRevenue,
          monthly: monthlyGrossRevenue,
          adminEarnings,
          monthlyAdminEarnings
        },
        transactions: {
          total: totalTransactions,
          completed: completedTransactions
        },
        reviews: {
          total: totalReviews
        },
        issues: {
          total: totalIssues
        },
        chart,
        recentTransactions,
        recentIssues: await Case.findAll({
          where: { status: { [Op.in]: ['cancelled', 'reviewing'] } },
          include: [
            { model: User, as: 'client', attributes: ['id', 'full_name', 'email'] },
            { model: User, as: 'lawyer', attributes: ['id', 'full_name', 'email'] }
          ],
          order: [['updated_at', 'DESC']],
          limit: 10
        }),
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay thong ke' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, isActive } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) {
      const roleRecord = await Role.findOne({ where: { name: role } });
      if (roleRecord) where.role_id = roleRecord.id;
    }
    if (isActive !== undefined) where.is_active = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { full_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      include: [{ model: Role, as: 'role' }],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay danh sach nguoi dung' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Khong tim thay nguoi dung' });
    }

    await user.update({ is_active: isActive });

    res.json({
      success: true,
      message: `Tai khoan da duoc ${isActive ? 'kich hoat' : 'khoa'}`,
      data: { user }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Loi khi cap nhat trang thai' });
  }
};

const getPendingLawyers = async (req, res) => {
  try {
    const lawyers = await Lawyer.findAll({
      where: { verification_status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          include: [{ model: Role, as: 'role' }]
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({ success: true, data: { lawyers } });
  } catch (error) {
    console.error('Error getting pending lawyers:', error);
    res.status(500).json({ success: false, message: 'Loi khi lay danh sach luat su' });
  }
};

const verifyLawyer = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { status, notes } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trang thai khong hop le' });
    }

    const lawyer = await Lawyer.findByPk(lawyerId, {
      include: [{ model: User, as: 'user' }]
    });

    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Khong tim thay luat su' });
    }

    await lawyer.update({
      verification_status: status,
      verification_notes: notes,
      verified_at: new Date(),
      verified_by: req.user.id
    });

    if (status === 'verified') {
      await lawyer.user.update({ is_active: true });
    }

    res.json({
      success: true,
      message: `Luat su da duoc ${status === 'verified' ? 'duyet' : 'tu choi'}`,
      data: { lawyer }
    });
  } catch (error) {
    console.error('Error verifying lawyer:', error);
    res.status(500).json({ success: false, message: 'Loi khi duyet luat su' });
  }
};

const negotiateLawyer = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Nội dung thương thảo không được để trống' });
    }

    const lawyer = await Lawyer.findByPk(lawyerId, {
      include: [{ model: User, as: 'user' }]
    });

    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy luật sư' });
    }

    // Send negotiation email
    (lawyer.user.email, lawyer.user.full_name, message);

    // Update verification notes to log negotiation
    await lawyer.update({
      verification_notes: `${lawyer.verification_notes || ''}\n[Admin Negotiation ${new Date().toLocaleDateString()}]: ${message}`,
      verification_status: 'pending' // Ensure it remains pending
    });

    res.json({
      success: true,
      message: 'Email thương thảo đã được gửi đến luật sư',
    });
  } catch (error) {
    console.error('Error negotiating lawyer:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi thương thảo' });
  }
};

const updateLawyerFee = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { consultationFee } = req.body;

    if (!consultationFee) {
      return res.status(400).json({ success: false, message: 'Phí tư vấn không hợp lệ' });
    }

    const lawyer = await Lawyer.findByPk(lawyerId);
    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy luật sư' });
    }

    await lawyer.update({
      consultation_fee: consultationFee,
      verification_notes: `${lawyer.verification_notes || ''}\n[Admin Price Adjustment ${new Date().toLocaleDateString()}]: Cập nhật phí thành ${Number(consultationFee).toLocaleString()}đ`
    });

    res.json({
      success: true,
      message: 'Đã cập nhật mức phí tư vấn thành công',
      data: { lawyer }
    });
  } catch (error) {
    console.error('Error updating lawyer fee:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật phí' });
  }
};

const getAllLawyers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    const lawyerWhere = {};
    if (status) lawyerWhere.verification_status = status;

    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Lawyer.findAndCountAll({
      where: lawyerWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: Object.keys(userWhere).length > 0 ? userWhere : null,
          include: [{ model: Role, as: 'role' }]
        }
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
    console.error('Error getting lawyers:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách luật sư' });
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
      userUpdate.avatar = `uploads/avatars/${req.file.filename}`;
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

const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await LawyerReview.findAndCountAll({
      include: [
        { model: User, as: 'lawyerUser', attributes: ['id', 'full_name', 'email', 'avatar'] },
        { model: User, as: 'clientUser', attributes: ['id', 'full_name', 'email', 'avatar'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({
      success: true,
      data: {
        reviews: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách đánh giá' });
  }
};

const toggleReviewVisibility = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { isHidden } = req.body;

    const review = await LawyerReview.findByPk(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    await review.update({ is_hidden: isHidden });

    res.json({
      success: true,
      message: `Đánh giá đã được ${isHidden ? 'ẳn' : 'hiện'}`,
      data: { review }
    });
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đánh giá' });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Payment.findAndCountAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
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
    console.error('Error getting transactions:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách giao dịch' });
  }
};

const getLawyerKPI = async (req, res) => {
  try {
    const { month } = req.query; // Format: 'YYYY-MM'
    const now = new Date();
    const queryMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = queryMonth.split('-').map(Number);

    const startDate = new Date(year, monthNum - 1, 1, 0, 0, 0);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const payments = await Payment.findAll({
      where: {
        status: 'completed',
        payment_type: { [Op.ne]: 'refund' },
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: Consultation,
          as: 'consultation',
          include: [
            {
              model: User,
              as: 'lawyer',
              attributes: ['id', 'full_name', 'email', 'avatar']
            }
          ]
        },
        {
          model: Case,
          as: 'case',
          include: [
            {
              model: User,
              as: 'lawyer',
              attributes: ['id', 'full_name', 'email', 'avatar']
            }
          ]
        }
      ]
    });

    const kpiData = {};

    payments.forEach(p => {
      // Get lawyer from consultation OR case
      const lawyer = p.consultation?.lawyer || p.case?.lawyer;
      if (!lawyer) return;

      if (!kpiData[lawyer.id]) {
        kpiData[lawyer.id] = {
          lawyerId: lawyer.id,
          fullName: lawyer.full_name,
          email: lawyer.email,
          avatar: lawyer.avatar,
          totalRevenue: 0,
          consultationCount: 0,
          caseCount: 0,
          adminFee: 0,
          lawyerEarning: 0
        };
      }

      const amount = Number(p.amount);
      kpiData[lawyer.id].totalRevenue += amount;
      kpiData[lawyer.id].adminFee += amount * 0.15;
      kpiData[lawyer.id].lawyerEarning += amount / 1.15;

      if (p.consultation_id) {
        kpiData[lawyer.id].consultationCount += 1;
      }
      if (p.case_id) {
        kpiData[lawyer.id].caseCount += 1;
      }
    });

    res.json({
      success: true,
      data: {
        month: queryMonth,
        kpi: Object.values(kpiData).sort((a, b) => b.totalRevenue - a.totalRevenue)
      }
    });
  } catch (error) {
    console.error('Error getting lawyer KPI:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy KPI luật sư' });
  }
};

const getPayouts = async (req, res) => {
  try {
    const { month, status } = req.query;
    const where = {};
    if (month) where.month = month;
    if (status) where.status = status;

    const payouts = await Payout.findAll({
      where,
      include: [
        {
          model: User,
          as: 'lawyer',
          attributes: ['id', 'full_name', 'email', 'avatar'],
          include: [
            {
              model: Lawyer,
              as: 'lawyer',
              attributes: ['bank_name', 'bank_account_number', 'bank_account_name']
            }
          ]
        }
      ],
      order: [['month', 'DESC'], ['total_revenue', 'DESC']]
    });

    res.json({ success: true, data: { payouts } });
  } catch (error) {
    console.error('Error getting payouts:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách quyết toán' });
  }
};

const generatePayouts = async (req, res) => {
  try {
    const { month } = req.body; // 'YYYY-MM'
    if (!month) return res.status(400).json({ success: false, message: 'Thiếu thông tin tháng' });

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1, 0, 0, 0);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // Get all completed payments for that month
    const payments = await Payment.findAll({
      where: {
        status: 'completed',
        payment_type: { [Op.ne]: 'refund' },
        created_at: { [Op.between]: [startDate, endDate] }
      },
      include: [
        { model: Consultation, as: 'consultation' },
        { model: Case, as: 'case' }
      ]
    });

    const lawyerStats = {};
    payments.forEach(p => {
      const lawyerId = p.consultation?.lawyer_id || p.case?.lawyer_id;
      if (!lawyerId) return;

      if (!lawyerStats[lawyerId]) {
        lawyerStats[lawyerId] = { totalRevenue: 0, lawyerEarning: 0 };
      }
      const amount = Number(p.amount);
      lawyerStats[lawyerId].totalRevenue += amount;
      lawyerStats[lawyerId].lawyerEarning += amount / 1.15;
    });

    const createdPayouts = [];
    for (const lawyerId of Object.keys(lawyerStats)) {
      // Check if already exists
      const existing = await Payout.findOne({ where: { lawyer_id: lawyerId, month } });
      if (!existing) {
        const p = await Payout.create({
          lawyer_id: lawyerId,
          month,
          total_revenue: lawyerStats[lawyerId].totalRevenue,
          lawyer_earning: lawyerStats[lawyerId].lawyerEarning,
          status: 'pending'
        });
        createdPayouts.push(p);
      } else if (existing.status === 'pending') {
        // Update if pending to catch new payments
        await existing.update({
          total_revenue: lawyerStats[lawyerId].totalRevenue,
          lawyer_earning: lawyerStats[lawyerId].lawyerEarning
        });
        createdPayouts.push(existing);
      }
    }

    res.json({ success: true, message: `Hệ thống đã tạo/cập nhật ${createdPayouts.length} bản ghi quyết toán cho tháng ${month}`, data: { createdPayouts } });
  } catch (error) {
    console.error('Error generating payouts:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo quyết toán' });
  }
};

const confirmPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { notes } = req.body;

    const payout = await Payout.findByPk(payoutId);
    if (!payout) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi quyết toán' });

    await payout.update({
      status: 'paid',
      paid_at: new Date(),
      notes: notes || payout.notes
    });

    res.json({ success: true, message: 'Đã xác nhận thanh toán quyết toán thành công', data: { payout } });
  } catch (error) {
    console.error('Error confirming payout:', error);
    res.status(500).json({ success: false, message: 'Lỗi xác nhận thanh toán' });
  }
};

const updatePayoutBonus = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { bonusAmount, notes } = req.body;

    const payout = await Payout.findByPk(payoutId);
    if (!payout) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi quyết toán' });

    await payout.update({
      bonus_amount: bonusAmount,
      notes: notes || payout.notes
    });

    res.json({ success: true, message: 'Đã cập nhật thưởng thành công', data: { payout } });
  } catch (error) {
    console.error('Error updating payout bonus:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật thưởng' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getPendingLawyers,
  verifyLawyer,
  negotiateLawyer,
  updateLawyerFee,
  getLawyerKPI,
  getAllLawyers,
  getMyProfile,
  updateMyProfile,
  getAllReviews,
  toggleReviewVisibility,
  getAllTransactions,
  // Payout exports
  getPayouts,
  generatePayouts,
  confirmPayout,
  updatePayoutBonus
};

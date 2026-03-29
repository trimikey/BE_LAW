'use strict';

const { Case, User } = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs by role name
    const { Role } = require('../models');
    const clientRole = await Role.findOne({ where: { name: 'client' } });
    const lawyerRole = await Role.findOne({ where: { name: 'lawyer' } });
    
    const clients = await User.findAll({ 
      where: { role_id: clientRole.id },
      limit: 3 
    });
    const lawyers = await User.findAll({ 
      where: { role_id: lawyerRole.id },
      limit: 2 
    });

    if (clients.length === 0 || lawyers.length === 0) {
      console.log('⚠️ Không có client hoặc lawyer để tạo cases. Vui lòng chạy seed users trước.');
      return;
    }

    const cases = [
      {
        client_id: clients[0].id,
        lawyer_id: lawyers[0].id,
        title: 'Tư vấn về hợp đồng lao động',
        description: 'Cần tư vấn về các điều khoản trong hợp đồng lao động, đặc biệt là phần nghỉ phép và bảo hiểm.',
        case_type: 'labor',
        status: 'in_progress',
        priority: 'high',
        estimated_fee: 2000000,
        started_at: new Date('2025-01-10'),
        created_at: new Date('2025-01-10'),
        updated_at: new Date('2025-01-10')
      },
      {
        client_id: clients[0].id,
        lawyer_id: lawyers[0].id,
        title: 'Soạn thảo hợp đồng mua bán',
        description: 'Cần soạn thảo hợp đồng mua bán bất động sản với các điều khoản bảo vệ quyền lợi người mua.',
        case_type: 'contract',
        status: 'pending',
        priority: 'medium',
        estimated_fee: 5000000,
        created_at: new Date('2025-01-12'),
        updated_at: new Date('2025-01-12')
      },
      {
        client_id: clients[1]?.id || clients[0].id,
        lawyer_id: lawyers[1]?.id || lawyers[0].id,
        title: 'Tranh chấp hợp đồng thương mại',
        description: 'Có tranh chấp về việc thanh toán và giao hàng trong hợp đồng thương mại. Cần tư vấn về quy trình giải quyết.',
        case_type: 'dispute',
        status: 'pending',
        priority: 'urgent',
        estimated_fee: 10000000,
        created_at: new Date('2025-01-13'),
        updated_at: new Date('2025-01-13')
      },
      {
        client_id: clients[2]?.id || clients[0].id,
        lawyer_id: lawyers[0].id,
        title: 'Tư vấn thành lập doanh nghiệp',
        description: 'Muốn thành lập công ty TNHH, cần tư vấn về thủ tục, vốn điều lệ và các quy định pháp luật.',
        case_type: 'corporate',
        status: 'completed',
        priority: 'medium',
        estimated_fee: 3000000,
        actual_fee: 3000000,
        started_at: new Date('2025-01-05'),
        completed_at: new Date('2025-01-15'),
        created_at: new Date('2025-01-05'),
        updated_at: new Date('2025-01-15')
      },
      {
        client_id: clients[0].id,
        lawyer_id: null, // Chưa được gán luật sư
        title: 'Tư vấn về thuế doanh nghiệp',
        description: 'Cần tư vấn về nghĩa vụ thuế TNDN và VAT cho doanh nghiệp mới thành lập.',
        case_type: 'tax',
        status: 'pending',
        priority: 'low',
        estimated_fee: 1500000,
        created_at: new Date('2025-01-14'),
        updated_at: new Date('2025-01-14')
      }
    ];

    await Case.bulkCreate(cases);
    console.log('✅ Đã tạo cases mẫu');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('cases', null, {});
  }
};

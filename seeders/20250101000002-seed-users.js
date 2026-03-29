'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Hash password cho tất cả users (password: Password123!)
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // Lấy role IDs từ database
    const roles = await queryInterface.sequelize.query(
      "SELECT id, name FROM roles",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.name] = role.id;
    });

    // Tạo admin user
    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@lawyerplatform.com',
        password: hashedPassword,
        full_name: 'Admin User',
        phone: '0900000001',
        role_id: roleMap['admin'],
        is_active: true,
        email_verified: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'admin2@lawyerplatform.com',
        password: hashedPassword,
        full_name: 'Nguyễn Văn Admin',
        phone: '0900000002',
        role_id: roleMap['admin'],
        is_active: true,
        email_verified: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Lấy ID của admin users vừa tạo
    const admins = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email IN ('admin@lawyerplatform.com', 'admin2@lawyerplatform.com') ORDER BY email",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Tạo lawyer users
    const lawyers = [
      {
        email: 'lawyer1@lawyerplatform.com',
        password: hashedPassword,
        full_name: 'Trần Văn Luật',
        phone: '0911111111',
        role_id: roleMap['lawyer'],
        is_active: true,
        email_verified: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'lawyer2@lawyerplatform.com',
        password: hashedPassword,
        full_name: 'Lê Thị Pháp',
        phone: '0922222222',
        role_id: roleMap['lawyer'],
        is_active: true,
        email_verified: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'lawyer3@lawyerplatform.com',
        password: hashedPassword,
        full_name: 'Phạm Văn Tư Vấn',
        phone: '0933333333',
        role_id: roleMap['lawyer'],
        is_active: false, // Chưa được verify
        email_verified: false,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('users', lawyers, {});

    // Lấy ID của lawyer users vừa tạo
    const lawyerUsers = await queryInterface.sequelize.query(
      "SELECT id, email FROM users WHERE email LIKE 'lawyer%@lawyerplatform.com' ORDER BY email",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Tạo thông tin lawyer
    const lawyerInfos = [
      {
        user_id: lawyerUsers[0].id,
        bar_number: 'LS-001',
        certificate_number: 'CC-001-2020',
        license_issued_date: new Date('2020-01-15'),
        license_expiry_date: new Date('2025-01-15'),
        law_firm: 'Văn phòng Luật sư Trần Văn Luật',
        specialties: JSON.stringify(['Pháp lý doanh nghiệp', 'Hợp đồng thương mại']),
        years_of_experience: 5,
        bio: 'Luật sư với hơn 5 năm kinh nghiệm trong lĩnh vực pháp lý doanh nghiệp và hợp đồng thương mại.',
        verification_status: 'verified',
        verified_at: new Date(),
        verified_by: admins && admins.length > 0 ? admins[0].id : null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: lawyerUsers[1].id,
        bar_number: 'LS-002',
        certificate_number: 'CC-002-2018',
        license_issued_date: new Date('2018-06-20'),
        license_expiry_date: new Date('2026-06-20'),
        law_firm: 'Văn phòng Luật sư Lê Thị Pháp',
        specialties: JSON.stringify(['Nhân sự & lao động', 'Tranh chấp & tố tụng']),
        years_of_experience: 7,
        bio: 'Chuyên gia về luật lao động và giải quyết tranh chấp với hơn 7 năm kinh nghiệm.',
        verification_status: 'verified',
        verified_at: new Date(),
        verified_by: admins && admins.length > 0 ? admins[0].id : null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: lawyerUsers[2].id,
        bar_number: 'LS-003',
        certificate_number: 'CC-003-2023',
        license_issued_date: new Date('2023-03-10'),
        license_expiry_date: new Date('2028-03-10'),
        law_firm: 'Văn phòng Luật sư Phạm Văn Tư Vấn',
        specialties: JSON.stringify(['Thuế & tuân thủ', 'Sở hữu trí tuệ']),
        years_of_experience: 2,
        bio: 'Luật sư trẻ với chuyên môn về thuế và sở hữu trí tuệ.',
        verification_status: 'pending',
        verified_at: null,
        verified_by: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('lawyers', lawyerInfos, {});

    // Tạo client users
    const clients = [
      {
        email: 'client1@example.com',
        password: hashedPassword,
        full_name: 'Nguyễn Văn Khách',
        phone: '0944444444',
        role_id: roleMap['client'],
        is_active: true,
        email_verified: true,
        last_login: new Date('2025-01-10'),
        created_at: new Date('2024-12-01'),
        updated_at: new Date()
      },
      {
        email: 'client2@example.com',
        password: hashedPassword,
        full_name: 'Trần Thị Hàng',
        phone: '0955555555',
        role_id: roleMap['client'],
        is_active: true,
        email_verified: true,
        last_login: new Date('2025-01-12'),
        created_at: new Date('2024-11-15'),
        updated_at: new Date()
      },
      {
        email: 'client3@example.com',
        password: hashedPassword,
        full_name: 'Lê Văn Doanh Nghiệp',
        phone: '0966666666',
        role_id: roleMap['client'],
        is_active: true,
        email_verified: false,
        last_login: null,
        created_at: new Date('2025-01-05'),
        updated_at: new Date()
      },
      {
        email: 'client4@example.com',
        password: hashedPassword,
        full_name: 'Phạm Thị Công Ty',
        phone: '0977777777',
        role_id: roleMap['client'],
        is_active: true,
        email_verified: true,
        last_login: new Date('2025-01-14'),
        created_at: new Date('2024-10-20'),
        updated_at: new Date()
      },
      {
        email: 'client5@example.com',
        password: hashedPassword,
        full_name: 'Hoàng Văn Startup',
        phone: '0988888888',
        role_id: roleMap['client'],
        is_active: true,
        email_verified: true,
        last_login: new Date('2025-01-13'),
        created_at: new Date('2024-09-10'),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('users', clients, {});
  },

  async down(queryInterface, Sequelize) {
    // Xóa lawyers trước (do foreign key constraint)
    await queryInterface.bulkDelete('lawyers', {
      bar_number: { [Sequelize.Op.in]: ['LS-001', 'LS-002', 'LS-003'] }
    }, {});

    // Xóa users
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: [
          'admin@lawyerplatform.com',
          'admin2@lawyerplatform.com',
          'lawyer1@lawyerplatform.com',
          'lawyer2@lawyerplatform.com',
          'lawyer3@lawyerplatform.com',
          'client1@example.com',
          'client2@example.com',
          'client3@example.com',
          'client4@example.com',
          'client5@example.com'
        ]
      }
    }, {});
  }
};

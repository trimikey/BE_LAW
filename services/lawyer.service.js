const { Lawyer, User } = require("../models");
const { Op } = require("sequelize");

exports.getLawyerById = async (id) => {
  try {
    const lawyer = await Lawyer.findOne({
      where: { id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ["id", "full_name", "email", "phone", "avatar"],
          include: [
            {
              model: require('../models').LawyerReview,
              as: 'receivedReviews',
              where: { is_hidden: false },
              required: false,
              include: [
                {
                  model: User,
                  as: 'clientUser',
                  attributes: ['id', 'full_name', 'avatar']
                }
              ]
            }
          ]
        },
      ],
    });
    return lawyer;
  } catch (error) {
    throw error;
  }
};

exports.getLawyers = async ({ page, limit, search, specialty, city, experience, education, minFee, maxFee, minRating, sort }) => {
  try {
    const offset = (page - 1) * limit;

    // Filters for Lawyer table
    const lawyerWhere = {
      verification_status: 'verified'
    };

    // Filters for User table
    const userWhere = {};

    if (search) {
      // Search by lawyer name
      userWhere.full_name = { [Op.like]: `%${search}%` };
    }

    if (specialty) {
      // Support searching "Luáº­t doanh nghiá»‡p" getting "Doanh nghiá»‡p"
      // We search with %keyword%
      lawyerWhere.specialties = {
        [Op.like]: `%${specialty.toLowerCase()}%`
      };
    }

    if (city) {
      lawyerWhere.city = { [Op.like]: `%${city}%` };
    }

    if (education) {
      lawyerWhere.education = { [Op.like]: `%${education}%` };
    }

    if (experience) {
      lawyerWhere.years_of_experience = { [Op.gte]: Number(experience) };
    }

    if (minFee !== undefined || maxFee !== undefined) {
      lawyerWhere.consultation_fee = {};
      if (minFee !== undefined) lawyerWhere.consultation_fee[Op.gte] = minFee;
      if (maxFee !== undefined) lawyerWhere.consultation_fee[Op.lte] = maxFee;
    }

    if (minRating) {
      lawyerWhere.rating = { [Op.gte]: minRating };
    }

    // Sorting
    const order = [];
    if (sort === 'rating') {
      order.push(['rating', 'DESC']);
    } else if (sort === 'experience') {
      order.push(['years_of_experience', 'DESC']);
    } else if (sort === 'fee_asc') {
      order.push(['consultation_fee', 'ASC']);
    } else if (sort === 'fee_desc') {
      order.push(['consultation_fee', 'DESC']);
    } else {
      order.push(['created_at', 'DESC']);
    }

    console.log('DEBUG WHERE:', { lawyerWhere, userWhere });

    const { rows, count } = await Lawyer.findAndCountAll({
      where: lawyerWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: userWhere,
          required: true,
          attributes: ["id", "full_name", "email", "phone", "avatar"],
        },
      ],
      limit,
      offset,
      order,
    });

    return {
      lawyers: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    throw error;
  }
};


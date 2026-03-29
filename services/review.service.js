const { LawyerReview, Lawyer } = require('../models');
const { fn, col } = require('sequelize');

const refreshLawyerRating = async (lawyerUserId) => {
  const aggregate = await LawyerReview.findOne({
    where: {
      lawyer_id: lawyerUserId,
      is_hidden: false
    },
    attributes: [
      [fn('AVG', col('rating')), 'avgRating'],
      [fn('COUNT', col('id')), 'reviewCount']
    ],
    raw: true
  });

  const avgRatingRaw = Number(aggregate?.avgRating || 0);
  const reviewCount = Number(aggregate?.reviewCount || 0);
  const roundedRating = reviewCount > 0 ? Math.round(avgRatingRaw * 10) / 10 : 0;

  await Lawyer.update(
    {
      rating: roundedRating,
      review_count: reviewCount
    },
    {
      where: { user_id: lawyerUserId }
    }
  );

  return {
    rating: roundedRating,
    reviewCount
  };
};

module.exports = {
  refreshLawyerRating
};


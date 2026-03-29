const sequelize = require('../config/database');
const Role = require('./Role');
const User = require('./User');
const PasswordReset = require('./PasswordReset');
const RefreshToken = require('./RefreshToken');
const Lawyer = require('./Lawyer');
const Case = require('./Case');
const CaseStep = require('./CaseStep');
const CaseInterest = require('./CaseInterest');
const Consultation = require('./Consultation');
const Payment = require('./Payment');
const Document = require('./Document');
const Message = require('./message');
const LawyerAvailability = require('./LawyerAvailability');
const VideoCallQuota = require('./VideoCallQuota');
const LawyerReview = require('./LawyerReview');
const Inquiry = require('./Inquiry');
const Payout = require('./Payout');

// Define associations
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

PasswordReset.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(PasswordReset, { foreignKey: 'user_id', as: 'passwordResets' });

RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });

Lawyer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Lawyer, { foreignKey: 'user_id', as: 'lawyer' });

// Case associations
Case.belongsTo(User, { foreignKey: 'client_id', as: 'client' });
Case.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
User.hasMany(Case, { foreignKey: 'client_id', as: 'clientCases' });
User.hasMany(Case, { foreignKey: 'lawyer_id', as: 'lawyerCases' });

// Consultation associations
Consultation.belongsTo(User, { foreignKey: 'client_id', as: 'client' });
Consultation.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
Consultation.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
User.hasMany(Consultation, { foreignKey: 'client_id', as: 'clientConsultations' });
User.hasMany(Consultation, { foreignKey: 'lawyer_id', as: 'lawyerConsultations' });
Case.hasMany(Consultation, { foreignKey: 'case_id', as: 'consultations' });

// Payment associations
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Payment.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
Payment.belongsTo(Consultation, { foreignKey: 'consultation_id', as: 'consultation' });
User.hasMany(Payment, { foreignKey: 'user_id', as: 'payments' });
Case.hasMany(Payment, { foreignKey: 'case_id', as: 'payments' });
Consultation.hasMany(Payment, { foreignKey: 'consultation_id', as: 'payments' });

// CaseStep associations
CaseStep.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
CaseStep.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });
Case.hasMany(CaseStep, { foreignKey: 'case_id', as: 'steps' });
User.hasMany(CaseStep, { foreignKey: 'assigned_to', as: 'assignedSteps' });

// Document associations
Document.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
Document.belongsTo(Consultation, { foreignKey: 'consultation_id', as: 'consultation' });
Document.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });
Document.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });
Document.belongsTo(Document, { foreignKey: 'parent_document_id', as: 'parentDocument' });
Case.hasMany(Document, { foreignKey: 'case_id', as: 'documents' });
Consultation.hasMany(Document, { foreignKey: 'consultation_id', as: 'documents' });
User.hasMany(Document, { foreignKey: 'uploaded_by', as: 'uploadedDocuments' });

Document.belongsTo(CaseStep, { foreignKey: 'case_step_id', as: 'step' });
CaseStep.hasMany(Document, { foreignKey: 'case_step_id', as: 'stepDocuments' });

// CaseInterest associations
CaseInterest.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
CaseInterest.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
Case.hasMany(CaseInterest, { foreignKey: 'case_id', as: 'interests' });
User.hasMany(CaseInterest, { foreignKey: 'lawyer_id', as: 'caseInterests' });

// Message associations
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages' });

// Lawyer availability associations
LawyerAvailability.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
LawyerAvailability.belongsTo(User, { foreignKey: 'booked_by_client_id', as: 'bookedByClient' });
LawyerAvailability.belongsTo(Consultation, { foreignKey: 'booked_consultation_id', as: 'bookedConsultation' });
User.hasMany(LawyerAvailability, { foreignKey: 'lawyer_id', as: 'availabilitySlots' });
User.hasMany(LawyerAvailability, { foreignKey: 'booked_by_client_id', as: 'bookedSlots' });
Consultation.hasOne(LawyerAvailability, { foreignKey: 'booked_consultation_id', as: 'availabilitySlot' });

// Video call quota associations
VideoCallQuota.belongsTo(User, { foreignKey: 'client_id', as: 'client' });
VideoCallQuota.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
User.hasMany(VideoCallQuota, { foreignKey: 'client_id', as: 'videoCallClientQuotas' });
User.hasMany(VideoCallQuota, { foreignKey: 'lawyer_id', as: 'videoCallLawyerQuotas' });

// LawyerReview associations
LawyerReview.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyerUser' });
LawyerReview.belongsTo(User, { foreignKey: 'client_id', as: 'clientUser' });
User.hasMany(LawyerReview, { foreignKey: 'lawyer_id', as: 'receivedReviews' });
User.hasMany(LawyerReview, { foreignKey: 'client_id', as: 'givenReviews' });

// Inquiry associations
Inquiry.belongsTo(User, { foreignKey: 'lawyer_id', as: 'assigned_lawyer' });
User.hasMany(Inquiry, { foreignKey: 'lawyer_id', as: 'managed_inquiries' });

// Payout associations
Payout.belongsTo(User, { foreignKey: 'lawyer_id', as: 'lawyer' });
User.hasMany(Payout, { foreignKey: 'lawyer_id', as: 'payouts' });

module.exports = {
    sequelize,
    Role,
    User,
    PasswordReset,
    RefreshToken,
    Lawyer,
    Case,
    CaseStep,
    CaseInterest,
    Consultation,
    Payment,
    VideoCallQuota,
    LawyerAvailability,
    Document,
    Message,
    LawyerReview,
    Inquiry,
    Payout
};

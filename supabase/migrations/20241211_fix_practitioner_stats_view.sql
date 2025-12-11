-- Fix practitioner_stats view to include all columns from practitioners table
-- The view was missing Stripe subscription columns added after initial creation

DROP VIEW IF EXISTS practitioner_stats;

CREATE OR REPLACE VIEW practitioner_stats AS
SELECT
  p.*,
  COALESCE(patient_counts.patient_count, 0) as patient_count,
  COALESCE(visit_counts.visit_count, 0) as visit_count,
  COALESCE(visit_counts.visits_this_week, 0) as visits_this_week,
  COALESCE(visit_counts.visits_this_month, 0) as visits_this_month,
  COALESCE(payment_sums.total_payments, 0) as total_payments,
  COALESCE(payment_sums.payments_this_month, 0) as payments_this_month,
  COALESCE(claim_counts.pending_claims_count, 0) as pending_claims_count
FROM practitioners p
LEFT JOIN (
  SELECT pr.id as practitioner_id, COUNT(DISTINCT pat.id) as patient_count
  FROM practitioners pr
  LEFT JOIN patients_non_phi pat ON pat.owner_user_id = pr.user_id
  GROUP BY pr.id
) patient_counts ON patient_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COUNT(v.id) as visit_count,
    COUNT(CASE WHEN v.visit_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as visits_this_week,
    COUNT(CASE WHEN v.visit_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as visits_this_month
  FROM practitioners pr
  LEFT JOIN visits_non_phi v ON v.owner_user_id = pr.user_id
  GROUP BY pr.id
) visit_counts ON visit_counts.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COALESCE(SUM(pay.amount), 0) as total_payments,
    COALESCE(SUM(CASE WHEN pay.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN pay.amount ELSE 0 END), 0) as payments_this_month
  FROM practitioners pr
  LEFT JOIN payments_non_phi pay ON pay.owner_user_id = pr.user_id
  GROUP BY pr.id
) payment_sums ON payment_sums.practitioner_id = p.id
LEFT JOIN (
  SELECT pr.id as practitioner_id,
    COUNT(CASE WHEN c.status IN ('TO_SUBMIT', 'SUBMITTED', 'PENDING') THEN 1 END) as pending_claims_count
  FROM practitioners pr
  LEFT JOIN claims_non_phi c ON c.owner_user_id = pr.user_id
  GROUP BY pr.id
) claim_counts ON claim_counts.practitioner_id = p.id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON practitioner_stats TO authenticated;
GRANT SELECT ON practitioner_stats TO service_role;

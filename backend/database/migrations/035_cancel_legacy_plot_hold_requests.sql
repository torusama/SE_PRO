-- Close any legacy hold workflow that may still be active in an older
-- deployment. Only release a plot when no live purchase, contract, or current
-- ownership record is using it.
WITH legacy_hold_plots AS (
  SELECT DISTINCT rp.plot_id
  FROM request_plots rp
  JOIN reservation_requests rr ON rr.request_id = rp.request_id
  WHERE rr.request_type = 'reserve'
    AND rr.status IN ('draft', 'pending', 'submitted', 'approved')
    AND rr.is_deleted = FALSE
)
UPDATE plots p
SET status = 'available',
    reserved_until = NULL,
    updated_at = NOW()
FROM legacy_hold_plots legacy
WHERE p.plot_id = legacy.plot_id
  AND p.status IN ('pending', 'reserved')
  AND p.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM request_plots purchase_plot
    JOIN reservation_requests purchase_request
      ON purchase_request.request_id = purchase_plot.request_id
    WHERE purchase_plot.plot_id = p.plot_id
      AND purchase_request.request_type = 'purchase'
      AND purchase_request.status IN ('draft', 'pending', 'submitted', 'approved')
      AND purchase_request.is_deleted = FALSE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM contract_plots contract_plot
    JOIN contracts contract ON contract.contract_id = contract_plot.contract_id
    WHERE contract_plot.plot_id = p.plot_id
      AND contract.status IN ('draft', 'active')
      AND contract.is_deleted = FALSE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ownership_records ownership
    WHERE ownership.plot_id = p.plot_id
      AND ownership.is_current = TRUE
  );

UPDATE offline_appointments appointment
SET status = 'cancelled',
    status_note = 'Tự động hủy khi loại bỏ chức năng giữ lô',
    cancelled_at = COALESCE(appointment.cancelled_at, NOW()),
    updated_at = NOW()
FROM reservation_requests request
WHERE appointment.request_id = request.request_id
  AND request.request_type = 'reserve'
  AND request.status IN ('draft', 'pending', 'submitted', 'approved')
  AND appointment.status = 'scheduled'
  AND appointment.is_deleted = FALSE;

UPDATE reservation_requests
SET status = 'cancelled',
    admin_note = COALESCE(NULLIF(admin_note, '') || E'\n', '') ||
      'Tự động hủy khi loại bỏ chức năng giữ lô',
    updated_at = NOW()
WHERE request_type = 'reserve'
  AND status IN ('draft', 'pending', 'submitted', 'approved')
  AND is_deleted = FALSE;

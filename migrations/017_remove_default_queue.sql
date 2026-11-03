-- Services used a branch's default queue implicitly (no queue_services row).
-- Store those as explicit assignments so existing tenants keep the same queues.
INSERT INTO queue_services (branch_id, service_id, queue_id)
SELECT q.branch_id, s.id, q.id
FROM queues q
JOIN services s ON s.tenant_code = q.tenant_code
WHERE q.is_default
ON CONFLICT (branch_id, service_id) DO NOTHING;

DROP INDEX queues_one_default_per_branch_idx;

ALTER TABLE queues DROP COLUMN is_default;

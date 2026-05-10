SELECT
    c.CustomerId AS customer_id,
    c.CustomerNumber AS customer_number,
    s.SubscriptionId AS subscription_id,
    u.UsageEventId AS usage_event_id,
    CAST(u.UsageDate AS DATE) AS usage_date,
    u.UsageQuantity AS usage_quantity,
    u.BilledAmount AS billed_amount,
    svc.ServiceName AS service_name,
    svc.ServiceCategory AS service_category,
    SYSUTCDATETIME() AS load_date_time
FROM billing.Customer c
INNER JOIN billing.Subscription s
    ON c.CustomerId = s.CustomerId
INNER JOIN billing.UsageEvent u
    ON s.SubscriptionId = u.SubscriptionId
INNER JOIN billing.RatePlan rp
    ON s.RatePlanId = rp.RatePlanId
INNER JOIN billing.Service svc
    ON rp.ServiceId = svc.ServiceId;

SELECT

    c.CustomerId AS customer_id,

    c.CustomerNumber AS customer_number,

    s.SubscriptionId AS subscription_id,

    rp.RatePlanId AS plan_id,

    rp.PlanName AS plan_name,

    rp.PlanTier AS plan_tier,

    svc.ServiceName AS service_name,

    svc.ServiceCategory AS service_category,

    s.Quantity AS quantity,

    rp.StandardRate AS standard_rate,

    s.CurrentRate AS current_rate,

    SYSUTCDATETIME() AS load_date_time

FROM billing.Customers c

INNER JOIN billing.Subscriptions s

    ON c.CustomerId = s.CustomerId

INNER JOIN billing.RatePlans rp

    ON s.RatePlanId = rp.RatePlanId

INNER JOIN billing.Services svc

    ON rp.ServiceId = svc.ServiceId;

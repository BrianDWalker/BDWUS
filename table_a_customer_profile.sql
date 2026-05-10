SELECT
    c.CustomerId AS customer_id,
    c.CustomerNumber AS customer_number,
    c.CustomerName AS customer_name,
    c.CustomerType AS customer_type,
    c.Industry AS industry_type,
    c.Region AS customer_region,
    c.CountryCode AS country_code,
    c.Status AS customer_status,
    c.CreditRating AS credit_rating,
    SYSUTCDATETIME() AS load_date_time
FROM billing.Customers c;

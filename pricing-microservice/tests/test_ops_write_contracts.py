from uuid import UUID

from app.services import ops_write


def test_create_order_write_contract(monkeypatch):
    executed = []
    order_id = '11111111-1111-4111-8111-111111111111'

    monkeypatch.setattr(ops_write.uuid, 'uuid4', lambda: UUID(order_id))
    monkeypatch.setattr(ops_write, 'ensure_ops_storage', lambda: None)
    monkeypatch.setattr(ops_write, 'execute', lambda sql, params: executed.append((sql, params)))
    monkeypatch.setattr(ops_write, 'require_row', lambda sql, params: {'OrderId': params[0]})

    row = ops_write.create_order({
        'accountName': 'Apex Health',
        'serviceName': 'Fiber 1G',
        'lifecycleStage': 'Design',
        'overallStatus': 'Draft',
        'slaStatus': 'On Track',
    })

    assert row['OrderId'] == order_id
    assert 'INSERT INTO ops.Orders' in executed[0][0]
    assert executed[0][1][3:8] == ('Apex Health', 'Fiber 1G', 'Design', 'Draft', 'On Track')


def test_progress_order_write_contract(monkeypatch):
    executed = []
    order_id = UUID('11111111-1111-4111-8111-111111111111')

    monkeypatch.setattr(ops_write, 'ensure_ops_storage', lambda: None)
    monkeypatch.setattr(ops_write, 'execute', lambda sql, params: executed.append((sql, params)))

    def fake_require_row(sql, params):
        if 'IsDeleted = 0' in sql:
            return {
                'OrderId': str(order_id),
                'LifecycleStage': 'Design',
                'OverallStatus': 'Draft',
                'SlaStatus': 'On Track',
                'DueDate': None,
                'AssignedTeam': 'Ops',
                'CircuitId': 'CKT-1001',
                'Location': 'Primary site',
            }
        return {'OrderId': str(order_id), 'LifecycleStage': 'Provisioning'}

    monkeypatch.setattr(ops_write, 'require_row', fake_require_row)

    row = ops_write.update_order(order_id, {
        'lifecycleStage': 'Provisioning',
        'overallStatus': 'Provisioning',
        'slaStatus': 'On Track',
    })

    assert row['LifecycleStage'] == 'Provisioning'
    assert 'UPDATE ops.Orders SET' in executed[0][0]
    assert executed[0][1][:3] == ('Provisioning', 'Provisioning', 'On Track')
    assert executed[0][1][-1] == str(order_id)


def test_provisioning_job_links_to_order(monkeypatch):
    executed = []
    job_id = '22222222-2222-4222-8222-222222222222'
    order_id = '11111111-1111-4111-8111-111111111111'

    monkeypatch.setattr(ops_write.uuid, 'uuid4', lambda: UUID(job_id))
    monkeypatch.setattr(ops_write, 'ensure_ops_storage', lambda: None)
    monkeypatch.setattr(ops_write, 'execute', lambda sql, params: executed.append((sql, params)))
    monkeypatch.setattr(ops_write, 'require_row', lambda sql, params: {'ProvisioningJobId': params[0], 'OrderId': order_id})

    row = ops_write.create_provisioning_job({
        'orderId': order_id,
        'jobType': 'Provisioning',
        'ownerName': 'Provisioning Ops',
        'status': 'Queued',
    })

    assert row['OrderId'] == order_id
    assert 'INSERT INTO ops.ProvisioningJobs' in executed[0][0]
    assert executed[0][1][1] == order_id
    assert executed[0][1][3:6] == ('Provisioning', 'Provisioning Ops', 'Queued')


def test_billing_action_and_adjustment_contracts(monkeypatch):
    executed = []
    ids = iter([
        UUID('33333333-3333-4333-8333-333333333333'),
        UUID('44444444-4444-4444-8444-444444444444'),
    ])
    invoice_id = UUID('55555555-5555-4555-8555-555555555555')

    monkeypatch.setattr(ops_write.uuid, 'uuid4', lambda: next(ids))
    monkeypatch.setattr(ops_write, 'ensure_ops_storage', lambda: None)
    monkeypatch.setattr(ops_write, 'execute', lambda sql, params: executed.append((sql, params)))
    monkeypatch.setattr(ops_write, 'require_row', lambda sql, params: {'id': params[0]})

    ops_write.create_invoice_action(invoice_id, {
        'actionType': 'Review',
        'status': 'Open',
        'requestedBy': 'Billing Ops',
        'notes': 'Created from billing module',
    })
    ops_write.create_adjustment({
        'invoiceId': str(invoice_id),
        'adjustmentType': 'Credit',
        'amount': -100,
        'status': 'Pending',
        'reason': 'Created from billing module',
        'createdBy': 'Billing Ops',
    })

    assert 'INSERT INTO billingops.InvoiceActions' in executed[0][0]
    assert executed[0][1][1:] == (str(invoice_id), 'Review', 'Open', 'Billing Ops', 'Created from billing module')
    assert 'INSERT INTO billingops.Adjustments' in executed[1][0]
    assert executed[1][1][1:] == (str(invoice_id), 'ADJ-4444', 'Credit', -100, 'Pending', 'Created from billing module', 'Billing Ops')

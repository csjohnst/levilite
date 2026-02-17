-- Migration 00007: Seed data for development and testing
-- WARNING: This file should NOT be run in production.
-- It inserts test data with fixed UUIDs for reproducibility.

DO $$
DECLARE
  -- Organisation
  org_id UUID := 'a0000000-0000-0000-0000-000000000001';

  -- Schemes
  scheme_sunset UUID := 'b0000000-0000-0000-0000-000000000001';
  scheme_ocean  UUID := 'b0000000-0000-0000-0000-000000000002';
  scheme_park   UUID := 'b0000000-0000-0000-0000-000000000003';

  -- Lots (Sunset Gardens: 5 lots)
  lot_sg1 UUID := 'c0000000-0000-0000-0000-000000000001';
  lot_sg2 UUID := 'c0000000-0000-0000-0000-000000000002';
  lot_sg3 UUID := 'c0000000-0000-0000-0000-000000000003';
  lot_sg4 UUID := 'c0000000-0000-0000-0000-000000000004';
  lot_sg5 UUID := 'c0000000-0000-0000-0000-000000000005';

  -- Lots (Ocean View: 6 lots)
  lot_ov1 UUID := 'c0000000-0000-0000-0000-000000000011';
  lot_ov2 UUID := 'c0000000-0000-0000-0000-000000000012';
  lot_ov3 UUID := 'c0000000-0000-0000-0000-000000000013';
  lot_ov4 UUID := 'c0000000-0000-0000-0000-000000000014';
  lot_ov5 UUID := 'c0000000-0000-0000-0000-000000000015';
  lot_ov6 UUID := 'c0000000-0000-0000-0000-000000000016';

  -- Lots (Parkside Villas: 4 lots)
  lot_pv1 UUID := 'c0000000-0000-0000-0000-000000000021';
  lot_pv2 UUID := 'c0000000-0000-0000-0000-000000000022';
  lot_pv3 UUID := 'c0000000-0000-0000-0000-000000000023';
  lot_pv4 UUID := 'c0000000-0000-0000-0000-000000000024';

  -- Owners (10 owners)
  owner1 UUID := 'd0000000-0000-0000-0000-000000000001';
  owner2 UUID := 'd0000000-0000-0000-0000-000000000002';
  owner3 UUID := 'd0000000-0000-0000-0000-000000000003';
  owner4 UUID := 'd0000000-0000-0000-0000-000000000004';
  owner5 UUID := 'd0000000-0000-0000-0000-000000000005';
  owner6 UUID := 'd0000000-0000-0000-0000-000000000006';
  owner7 UUID := 'd0000000-0000-0000-0000-000000000007';
  owner8 UUID := 'd0000000-0000-0000-0000-000000000008';
  owner9 UUID := 'd0000000-0000-0000-0000-000000000009';
  owner10 UUID := 'd0000000-0000-0000-0000-000000000010';

BEGIN

  -- ============================================================
  -- Organisation
  -- ============================================================
  INSERT INTO public.organisations (id, name, abn, address, phone, email)
  VALUES (
    org_id,
    'Sunset Strata Management',
    '12345678901',
    '100 St Georges Terrace, Perth WA 6000',
    '08 9200 1234',
    'admin@sunsetstrata.com.au'
  );

  -- ============================================================
  -- Schemes
  -- ============================================================
  INSERT INTO public.schemes (id, organisation_id, scheme_number, scheme_name, scheme_type, street_address, suburb, state, postcode, abn, financial_year_end_month, financial_year_end_day, levy_frequency, levy_due_day, total_lot_entitlement, common_property_area_sqm, status)
  VALUES
    (scheme_sunset, org_id, 'SP 12345', 'Sunset Gardens', 'strata', '42 Marine Parade', 'Cottesloe', 'WA', '6011', '98765432101', 6, 30, 'quarterly', 1, 0, 350.00, 'active'),
    (scheme_ocean, org_id, 'SP 67890', 'Ocean View Apartments', 'strata', '15 Esplanade', 'Scarborough', 'WA', '6019', NULL, 6, 30, 'quarterly', 1, 0, 520.00, 'active'),
    (scheme_park, org_id, 'SP 11111', 'Parkside Villas', 'survey-strata', '8 Kings Park Road', 'West Perth', 'WA', '6005', NULL, 6, 30, 'annual', 1, 0, NULL, 'active');

  -- ============================================================
  -- Lots: Sunset Gardens (5 lots)
  -- ============================================================
  INSERT INTO public.lots (id, scheme_id, lot_number, unit_number, lot_type, unit_entitlement, voting_entitlement, floor_area_sqm, bedrooms, bathrooms, car_bays, status, occupancy_status)
  VALUES
    (lot_sg1, scheme_sunset, '1', '1', 'residential', 15, 15, 85.0, 2, 1, 1, 'active', 'owner-occupied'),
    (lot_sg2, scheme_sunset, '2', '2', 'residential', 15, 15, 85.0, 2, 1, 1, 'active', 'tenanted'),
    (lot_sg3, scheme_sunset, '3', '3', 'residential', 20, 20, 110.0, 3, 2, 2, 'active', 'owner-occupied'),
    (lot_sg4, scheme_sunset, '4', '4', 'residential', 12, 12, 65.0, 1, 1, 1, 'active', 'vacant'),
    (lot_sg5, scheme_sunset, '5', '5', 'residential', 18, 18, 95.0, 2, 1.5, 1, 'active', 'owner-occupied');

  -- ============================================================
  -- Lots: Ocean View Apartments (6 lots)
  -- ============================================================
  INSERT INTO public.lots (id, scheme_id, lot_number, unit_number, lot_type, unit_entitlement, voting_entitlement, floor_area_sqm, bedrooms, bathrooms, car_bays, status, occupancy_status)
  VALUES
    (lot_ov1, scheme_ocean, '1', '101', 'residential', 10, 10, 72.0, 2, 1, 1, 'active', 'owner-occupied'),
    (lot_ov2, scheme_ocean, '2', '102', 'residential', 10, 10, 72.0, 2, 1, 1, 'active', 'tenanted'),
    (lot_ov3, scheme_ocean, '3', '201', 'residential', 14, 14, 95.0, 3, 2, 1, 'active', 'owner-occupied'),
    (lot_ov4, scheme_ocean, '4', '202', 'residential', 14, 14, 95.0, 3, 2, 1, 'active', 'owner-occupied'),
    (lot_ov5, scheme_ocean, '5', 'G01', 'parking', 2, 2, NULL, NULL, NULL, NULL, 'active', 'owner-occupied'),
    (lot_ov6, scheme_ocean, '6', 'G02', 'parking', 2, 2, NULL, NULL, NULL, NULL, 'active', 'owner-occupied');

  -- ============================================================
  -- Lots: Parkside Villas (4 lots)
  -- ============================================================
  INSERT INTO public.lots (id, scheme_id, lot_number, unit_number, lot_type, unit_entitlement, voting_entitlement, floor_area_sqm, bedrooms, bathrooms, car_bays, status, occupancy_status)
  VALUES
    (lot_pv1, scheme_park, '1', '1', 'residential', 25, 25, 130.0, 3, 2, 2, 'active', 'owner-occupied'),
    (lot_pv2, scheme_park, '2', '2', 'residential', 25, 25, 130.0, 3, 2, 2, 'active', 'owner-occupied'),
    (lot_pv3, scheme_park, '3', '3', 'residential', 30, 30, 155.0, 4, 2.5, 2, 'active', 'tenanted'),
    (lot_pv4, scheme_park, '4', '4', 'residential', 20, 20, 105.0, 2, 1, 1, 'active', 'owner-occupied');

  -- ============================================================
  -- Owners (10 owners with realistic Australian details)
  -- ============================================================
  INSERT INTO public.owners (id, title, first_name, last_name, email, phone_mobile, postal_address_line1, postal_suburb, postal_state, postal_postcode, correspondence_method, status)
  VALUES
    (owner1, 'Mr', 'James', 'Mitchell', 'james.mitchell@email.com.au', '0412 345 678', '42 Marine Parade Unit 1', 'Cottesloe', 'WA', '6011', 'email', 'active'),
    (owner2, 'Ms', 'Sarah', 'Thompson', 'sarah.thompson@email.com.au', '0423 456 789', '42 Marine Parade Unit 2', 'Cottesloe', 'WA', '6011', 'email', 'active'),
    (owner3, 'Dr', 'David', 'Chen', 'david.chen@email.com.au', '0434 567 890', '42 Marine Parade Unit 3', 'Cottesloe', 'WA', '6011', 'both', 'active'),
    (owner4, 'Mrs', 'Linda', 'Nguyen', 'linda.nguyen@email.com.au', '0445 678 901', '10 Hay Street', 'Subiaco', 'WA', '6008', 'email', 'active'),
    (owner5, 'Mr', 'Robert', 'Patel', 'robert.patel@email.com.au', '0456 789 012', '42 Marine Parade Unit 5', 'Cottesloe', 'WA', '6011', 'email', 'active'),
    (owner6, 'Ms', 'Emma', 'Wilson', 'emma.wilson@email.com.au', '0467 890 123', '15 Esplanade Unit 101', 'Scarborough', 'WA', '6019', 'email', 'active'),
    (owner7, 'Mr', 'Michael', 'OBrien', 'michael.obrien@email.com.au', '0478 901 234', '15 Esplanade Unit 201', 'Scarborough', 'WA', '6019', 'email', 'active'),
    (owner8, 'Mrs', 'Karen', 'Rossi', 'karen.rossi@email.com.au', '0489 012 345', '8 Kings Park Road Unit 1', 'West Perth', 'WA', '6005', 'postal', 'active'),
    (owner9, 'Mr', 'Anthony', 'Lee', 'anthony.lee@email.com.au', '0490 123 456', '8 Kings Park Road Unit 2', 'West Perth', 'WA', '6005', 'email', 'active'),
    (owner10, 'Ms', 'Rachel', 'Kumar', 'rachel.kumar@email.com.au', '0401 234 567', '8 Kings Park Road Unit 3', 'West Perth', 'WA', '6005', 'email', 'active');

  -- ============================================================
  -- Lot ownerships (linking owners to lots)
  -- ============================================================

  -- Sunset Gardens
  INSERT INTO public.lot_ownerships (lot_id, owner_id, ownership_type, ownership_percentage, ownership_start_date, is_primary_contact)
  VALUES
    (lot_sg1, owner1, 'sole', 100.00, '2020-03-15', TRUE),
    (lot_sg2, owner2, 'sole', 100.00, '2019-07-01', TRUE),
    (lot_sg3, owner3, 'sole', 100.00, '2021-01-10', TRUE),
    (lot_sg4, owner4, 'sole', 100.00, '2022-06-20', TRUE),
    -- Lot 5: joint ownership (Robert Patel & Linda Nguyen -- tenants-in-common 60/40)
    (lot_sg5, owner5, 'tenants-in-common', 60.00, '2023-02-01', TRUE),
    (lot_sg5, owner4, 'tenants-in-common', 40.00, '2023-02-01', FALSE);

  -- Ocean View Apartments
  INSERT INTO public.lot_ownerships (lot_id, owner_id, ownership_type, ownership_percentage, ownership_start_date, is_primary_contact)
  VALUES
    (lot_ov1, owner6, 'sole', 100.00, '2021-09-15', TRUE),
    (lot_ov2, owner6, 'sole', 100.00, '2021-09-15', TRUE), -- Emma owns 2 lots
    (lot_ov3, owner7, 'sole', 100.00, '2020-11-01', TRUE),
    (lot_ov4, owner7, 'sole', 100.00, '2020-11-01', TRUE), -- Michael owns 2 lots
    (lot_ov5, owner6, 'sole', 100.00, '2021-09-15', TRUE), -- Emma's parking
    (lot_ov6, owner7, 'sole', 100.00, '2020-11-01', TRUE); -- Michael's parking

  -- Parkside Villas
  INSERT INTO public.lot_ownerships (lot_id, owner_id, ownership_type, ownership_percentage, ownership_start_date, is_primary_contact)
  VALUES
    (lot_pv1, owner8, 'sole', 100.00, '2018-04-01', TRUE),
    (lot_pv2, owner9, 'sole', 100.00, '2019-08-15', TRUE),
    (lot_pv3, owner10, 'sole', 100.00, '2022-12-01', TRUE),
    -- Lot 4: joint ownership (Karen Rossi & Anthony Lee -- joint-tenants)
    (lot_pv4, owner8, 'joint-tenants', 50.00, '2023-06-01', TRUE),
    (lot_pv4, owner9, 'joint-tenants', 50.00, '2023-06-01', FALSE);

  -- ============================================================
  -- Committee members (3)
  -- ============================================================
  INSERT INTO public.committee_members (scheme_id, owner_id, position, elected_at, term_end_date, is_active)
  VALUES
    (scheme_sunset, owner1, 'chair', '2024-10-15', '2025-10-15', TRUE),
    (scheme_sunset, owner3, 'treasurer', '2024-10-15', '2025-10-15', TRUE),
    (scheme_ocean, owner7, 'secretary', '2024-09-01', '2025-09-01', TRUE);

  -- ============================================================
  -- Tenants (2)
  -- ============================================================
  INSERT INTO public.tenants (lot_id, first_name, last_name, email, phone_mobile, lease_start_date, lease_end_date, lease_type, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, has_pets, pet_details, vehicle_make, vehicle_model, vehicle_rego, vehicle_color, status)
  VALUES
    (lot_sg2, 'Tom', 'Harper', 'tom.harper@email.com.au', '0432 111 222', '2024-01-15', '2025-01-14', 'fixed-term', 'Mary Harper', '0432 333 444', 'mother', FALSE, NULL, 'Toyota', 'Corolla', '1ABC234', 'White', 'current'),
    (lot_pv3, 'Priya', 'Sharma', 'priya.sharma@email.com.au', '0455 666 777', '2024-06-01', NULL, 'periodic', 'Ravi Sharma', '0455 888 999', 'partner', TRUE, '1 small dog (Cavoodle)', 'Mazda', 'CX-5', '1XYZ567', 'Blue', 'current');

END $$;

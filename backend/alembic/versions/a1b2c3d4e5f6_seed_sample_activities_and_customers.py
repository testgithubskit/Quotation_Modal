"""seed sample activities and customers

Revision ID: a1b2c3d4e5f6
Revises: dbe274a79acd
Create Date: 2026-09-15 12:30:00.000000
"""
from __future__ import annotations

from decimal import Decimal
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "dbe274a79acd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Marker used so downgrade can remove only this seed set.
SEED_PREFIX = "SEED-"

ACTIVITIES = [
    ("A001", "Concrete Cube Test", "150mm cube compressive strength, 7 & 28 day", "Nos", "450.00"),
    ("A002", "Rebound Hammer Test", "Non-destructive strength estimation on site", "Point", "350.00"),
    ("A003", "Ultrasonic Pulse Velocity", "Concrete quality grading by UPV", "Point", "600.00"),
    ("A004", "Steel Tensile Test", "Reinforcement bar tensile strength on UTM", "Nos", "550.00"),
    ("A005", "Bend / Rebend Test", "Steel bar bend and rebend as per IS", "Nos", "400.00"),
    ("A006", "Soil SBC Test", "Safe bearing capacity by plate load / SPT", "Location", "8500.00"),
    ("A007", "Atterberg Limits", "Liquid limit, plastic limit, plasticity index", "Sample", "1200.00"),
    ("A008", "Proctor Compaction", "Standard / modified proctor MDD & OMC", "Sample", "1800.00"),
    ("A009", "CBR Test", "California Bearing Ratio soaked/unsoaked", "Sample", "2500.00"),
    ("A010", "Grain Size Analysis", "Sieve analysis for coarse & fine aggregate", "Sample", "900.00"),
    ("A011", "Aggregate Crushing Value", "ACV test for coarse aggregate", "Sample", "1100.00"),
    ("A012", "Aggregate Impact Value", "AIV test for coarse aggregate", "Sample", "1000.00"),
    ("A013", "Flakiness & Elongation", "Shape indices for coarse aggregate", "Sample", "950.00"),
    ("A014", "Bitumen Penetration", "Penetration grade of bitumen", "Sample", "1500.00"),
    ("A015", "Bitumen Softening Point", "Ring & ball softening point", "Sample", "1400.00"),
    ("A016", "Marshall Stability", "Bituminous mix design Marshall test", "Sample", "3200.00"),
    ("A017", "Brick Compressive Strength", "Common / fly ash brick strength", "Set", "800.00"),
    ("A018", "Water Absorption - Brick", "24h immersion water absorption", "Set", "600.00"),
    ("A019", "Cement Fineness", "Blaine / sieve fineness of cement", "Sample", "700.00"),
    ("A020", "Cement Setting Time", "Initial and final setting time", "Sample", "750.00"),
    ("A021", "Slump Test", "Workability of fresh concrete", "Trial", "300.00"),
    ("A022", "Core Cutting & Testing", "In-situ concrete core strength", "Core", "2800.00"),
    ("A023", "Pile Integrity Test", "Low strain PIT for bored piles", "Pile", "4500.00"),
    ("A024", "Cover Meter Survey", "Rebar cover mapping on structural members", "Sqm", "45.00"),
    ("A025", "Half Cell Potential", "Corrosion potential mapping of rebars", "Sqm", "85.00"),
]

CUSTOMERS = [
    ("C001", "Arvind Rao", "arvind@raobuilders.in", "9900112233", "Gandhi Road, Davangere", "Rao Builders & Developers"),
    ("C002", "Meera Krishnan", "meera@skylineconstructions.com", "9845011223", "MG Road, Bengaluru", "Skyline Constructions"),
    ("C003", "Suresh Patil", "suresh@patilinfra.in", "9731123456", "Station Road, Hubballi", "Patil Infra Projects"),
    ("C004", "Ananya Hegde", "ananya@coastalrealty.co", "9886677889", "Pandeshwar, Mangaluru", "Coastal Realty"),
    ("C005", "Vikram Shetty", "vikram@shettysteel.com", "9900887766", "Peenya Industrial Area, Bengaluru", "Shetty Steel Traders"),
    ("C006", "Lakshmi Narayan", "lakshmi@lnassociates.in", "9742012345", "Jayanagar 4th Block, Bengaluru", "LN Associates"),
    ("C007", "Ramesh Gowda", "ramesh@gowdaestates.com", "9611223344", "Ring Road, Mysuru", "Gowda Estates"),
    ("C008", "Priya Desai", "priya@desaiinfra.com", "9876543210", "Ashok Nagar, Shivamogga", "Desai Infrastructure"),
    ("C009", "Karthik Rao", "karthik@raotechlabs.in", "9900221133", "Whitefield, Bengaluru", "Rao Tech Labs"),
    ("C010", "Nandini Joshi", "nandini@joshiprojects.com", "9738456123", "Tilak Nagar, Dharwad", "Joshi Projects Pvt Ltd"),
    ("C011", "Ajay Kumar", "ajay@akbuilders.co", "9845099887", "Bellary Road, Ballari", "AK Builders"),
    ("C012", "Sneha Kulkarni", "sneha@kulkarniconsult.in", "9887766554", "Model Colony, Pune", "Kulkarni Consultants"),
    ("C013", "Harish Bhat", "harish@bhatconstructions.com", "9611987654", "Kodialbail, Mangaluru", "Bhat Constructions"),
    ("C014", "Deepa Nair", "deepa@nairhomes.in", "9743987654", "Vyttila, Kochi", "Nair Homes"),
    ("C015", "Manjunath S", "manju@msinfra.in", "9901456789", "Chamarajpet, Davangere", "MS Infrastructure"),
    ("C016", "Fatima Begum", "fatima@fbdevelopers.com", "9845123098", "Kalaburagi City", "FB Developers"),
    ("C017", "Rohit Sharma", "rohit@sharmagroup.co", "9876001122", "Koramangala, Bengaluru", "Sharma Group"),
    ("C018", "Kavitha Reddy", "kavitha@reddyinfra.com", "9911223344", "Gachibowli, Hyderabad", "Reddy Infra Ltd"),
    ("C019", "Prakash Iyer", "prakash@iyercivil.in", "9731456780", "Adyar, Chennai", "Iyer Civil Labs"),
    ("C020", "Sunita Pawar", "sunita@pawarrealty.com", "9822012345", "FC Road, Pune", "Pawar Realty"),
]


def upgrade() -> None:
    conn = op.get_bind()

    orgs = conn.execute(sa.text("SELECT id FROM organizations")).fetchall()
    if not orgs:
        return

    activities_t = sa.table(
        "activities",
        sa.column("id", PGUUID),
        sa.column("organization_id", PGUUID),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("unit", sa.String),
        sa.column("unit_price", sa.Numeric),
        sa.column("currency", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("custom_data", JSONB),
    )
    customers_t = sa.table(
        "customers",
        sa.column("id", PGUUID),
        sa.column("organization_id", PGUUID),
        sa.column("customer_code", sa.String),
        sa.column("name", sa.String),
        sa.column("email", sa.String),
        sa.column("phone", sa.String),
        sa.column("website", sa.String),
        sa.column("tax_number", sa.String),
        sa.column("address", sa.Text),
        sa.column("notes", sa.Text),
        sa.column("is_active", sa.Boolean),
        sa.column("custom_data", JSONB),
    )

    activity_rows = []
    customer_rows = []

    for (org_id,) in orgs:
        for code, name, description, unit, price in ACTIVITIES:
            activity_rows.append(
                {
                    "id": uuid4(),
                    "organization_id": org_id,
                    "code": f"{SEED_PREFIX}{code}",
                    "name": name,
                    "description": description,
                    "unit": unit,
                    "unit_price": Decimal(price),
                    "currency": "INR",
                    "is_active": True,
                    "custom_data": {},
                }
            )
        for code, name, email, phone, address, company in CUSTOMERS:
            customer_rows.append(
                {
                    "id": uuid4(),
                    "organization_id": org_id,
                    "customer_code": f"{SEED_PREFIX}{code}",
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "website": None,
                    "tax_number": None,
                    "address": address,
                    "notes": company,
                    "is_active": True,
                    "custom_data": {},
                }
            )

    if activity_rows:
        op.bulk_insert(activities_t, activity_rows)
    if customer_rows:
        op.bulk_insert(customers_t, customer_rows)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM activities WHERE code LIKE :prefix"),
        {"prefix": f"{SEED_PREFIX}%"},
    )
    conn.execute(
        sa.text("DELETE FROM customers WHERE customer_code LIKE :prefix"),
        {"prefix": f"{SEED_PREFIX}%"},
    )

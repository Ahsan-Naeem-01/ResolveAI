"""Map intent → department/team."""

ROUTING = {
    "Refund Request": "Finance Team",
    "Payment Failure": "Finance Team",
    "Delivery Issue": "Logistics Team",
    "Product Complaint": "Support Team",
    "Account / Security": "Fraud / Security Team",
    "Promotion / Pricing": "Support Team",
    "Other": "Support Team",
}


def route_for(intent: str) -> str:
    return ROUTING.get(intent, "Support Team")

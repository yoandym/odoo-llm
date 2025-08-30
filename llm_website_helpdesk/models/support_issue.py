from odoo import fields, models


class SupportIssue(models.Model):
    _inherit = "support.issue"

    livechat_visitor_id = fields.Many2one(
        "website.visitor", string="Website Visitor", readonly=True, help="Visitor who created this ticket through livechat"
    )
    livechat_session_id = fields.Many2one(
        "discuss.channel", string="Livechat Session", readonly=True, help="Livechat session from which this ticket was created"
    )

    # Override the origin field to add 'llm_tool' option
    origin = fields.Selection(selection_add=[("llm_tool", "LLM Tool")], ondelete={"llm_tool": lambda recs: recs.write({"origin": "manual"})})

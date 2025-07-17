# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class LLMAssistant(models.Model):
    _inherit = "llm.assistant"

    # Website visibility
    is_website_visible = fields.Boolean(
        string="Available on public Website",
        default=False,
        tracking=True,
        help="If enabled, this assistant can be selected for use in website live chat channels.",
    )

    # Knowledge collection restrictions
    allowed_knowledge_collection_ids = fields.Many2many(
        "llm.knowledge.collection",
        string="Allowed Knowledge Collections",
        help="Knowledge collections that this assistant can access. If empty, the assistant can access all collections.",
    )

    # Stats for website usage
    website_session_count = fields.Integer(
        string="Website Chat Sessions",
        compute="_compute_website_session_count",
        help="Number of website chat sessions using this assistant",
    )

    @api.depends("thread_ids")
    def _compute_website_session_count(self):
        """Compute the number of website chat sessions using this assistant"""
        for assistant in self:
            # Count threads with website_chat relation
            assistant.website_session_count = self.env["discuss.channel"].search_count(
                [("assistant_id", "=", assistant.id), ("source", "=", "website_livechat")]
            )

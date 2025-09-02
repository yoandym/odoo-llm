# -*- coding: utf-8 -*-

import uuid
from odoo import fields, models


class ResPartner(models.Model):
    """
    Extends res.partner to inherit portal.mixin.

    This allows to identify a website visitor parent partner providing just its company partner_id and access_token,
    without authentication.
    """

    _inherit = "res.partner"

    access_token = fields.Char("Security Token", copy=False)

    def ensure_token(self):
        """Get the current record access token"""
        if not self.access_token:
            # we use a `write` to force the cache clearing otherwise `return self.access_token` will return False
            self.sudo().write({"access_token": str(uuid.uuid4())})
        return self.access_token

# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import UserError


class PromptCopyWizard(models.TransientModel):
    _name = 'llm.prompt.copy.wizard'
    _description = 'Prompt Copy Wizard'

    prompt_id = fields.Many2one('llm.prompt', string='Prompt to Duplicate', required=True)
    name = fields.Char(string='New Prompt Name', required=True)
    copy_mode = fields.Selection([
        ('duplicate', 'Duplicate Templates (recommended)'),
        ('link', 'Use Same Templates (shared)')
    ], string='Template Duplication Mode', default='duplicate', required=True)
    info = fields.Html(string='Info', readonly=True, compute='_compute_info')

    @api.depends('copy_mode')
    def _compute_info(self):
        for wizard in self:
            wizard.info = _(
                '<div class="alert alert-info" role="alert">'
                '<b>Duplicate Templates:</b> Copies all templates, so changes to the new prompt do not affect the original.<br/>'
                '<b>Use Same Templates:</b> Shares templates with the original prompt. Changes to templates will affect both prompts.'
                '</div>'
            )

    def action_copy_prompt(self):
        self.ensure_one()
        prompt = self.prompt_id
        new_prompt_vals = prompt.copy_data({'name': self.name})[0]
        if self.copy_mode == 'link':
            # Use same templates (just link to originals)
            new_prompt = self.env['llm.prompt'].create(new_prompt_vals)
        else:
            # Duplicate templates
            template_map = {}
            new_prompt = self.env['llm.prompt'].create(new_prompt_vals)
            for template in prompt.template_ids:
                new_template = template.copy({'prompt_id': new_prompt.id})
                template_map[template.id] = new_template.id
        
        # Return action to open the newly created prompt
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'llm.prompt',
            'res_id': new_prompt.id,
            'view_mode': 'form',
            'target': 'current',
        }
# -*- coding: utf-8 -*-
{
    'name': "LLM CRM Lead Creation",
    'summary': "Allow LLM assistants to create CRM leads when handover is not possible",
    'description': """
        This module adds a tool for LLM assistants to create CRM leads when:
        - No operators are available for handover
        - The conversation has commercial context
        - A lead capture is more appropriate than waiting for an operator
    """,
    'author': 'FIME Development Team',
    'website': 'https://www.fime.cl',
    'category': 'Hidden/Tools',
    'version': '17.0.1.0.0',
    'depends': [
        'llm_tool',
        'crm',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/llm_tool_data.xml',
    ],
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}

# -*- coding: utf-8 -*-

import logging
from typing import Any

from odoo import _, api, models
from odoo.addons.llm_tool.models.llm_tool_response_schema import FlowAction, StandardToolResponse

_logger = logging.getLogger(__name__)


class LLMToolHelpdesk(models.Model):
    _inherit = ["llm.tool"]

    @api.model
    def _get_available_implementations(self) -> list[tuple[str, str]]:
        implementations = super()._get_available_implementations()
        return implementations + [("website_helpdesk_ticket", "Create helpdesk ticket")]

    @api.model
    def website_helpdesk_ticket_execute(
        self, thread_id: int, name: str, description: str = "", project_id: str = "", issue_type: str = "", severity: str = ""
    ):
        """Create a helpdesk ticket from livechat conversation.

        Args:
            name: The summary of the helpdesk ticket.
            description: The detailed description of the issue.
            project_id: ID of the project to associate the ticket with (optional).
            issue_type_id: ID of the issue type (optional).
            severity_id: ID of the severity (optional).

        Returns:
            dict: Information about the created ticket.
        """
        try:
            SupportIssue = self.env["support.issue"]

            # Create the support issue
            vals = self._prepare_ticket_values(
                thread_id=thread_id,
                name=name,
                description=description,
                project_id=project_id,
                issue_type=issue_type,
                severity=severity,
            )

            issue = SupportIssue.sudo().create(vals)

            # Return information about the created ticket
            _msg = _(f"Support ticket {issue.code} created successfully.")
            return StandardToolResponse.create_action_tool_response(
                message=_msg,
                data={
                    "ticket_id": issue.id,
                    "code": issue.code,
                    "url": issue.issue_external_url,
                },
                flow_action=FlowAction.CONTINUE_CONVERSATION,
            )
        except Exception as e:
            _logger.exception(e)
            return StandardToolResponse.create_error_response(error_message=_("Failed to create helpdesk ticket."))

    def _prepare_ticket_values(self, **kwargs):
        """Prepare the values for creating a support ticket.

        Args:
            **kwargs: Additional keyword arguments to include in the ticket values.

        Returns:
            dict: The prepared values for the support ticket.
        """

        # if thread_id is present, use it to fulfill ticket values
        thread = False
        visitor = False
        if "thread_id" in kwargs:
            thread = self.env["discuss.channel"].browse(kwargs["thread_id"])

        # Get current website visitor information
        if thread and thread.exists():
            visitor = thread.livechat_visitor_id

        extentded_kwargs = kwargs.copy()
        extentded_kwargs.update({"thread": thread})
        extentded_kwargs.update({"visitor": visitor})

        name = kwargs.get("name") or (thread and thread.name) or _("No Subject")
        description = kwargs.get("description") or (thread and thread._get_channel_history()) or _("No Description")

        project = self._get_or_create_project(**extentded_kwargs)
        # project bad design workarround
        if not project.project_key:
            project.project_key = project._generate_project_key(project.name)

        issue_type = self._get_issue_type(**extentded_kwargs)
        severity = self._get_severity(**extentded_kwargs)

        vals = {
            "name": name,
            "description": description,
            "livechat_visitor_id": thread.livechat_visitor_id.id if thread and thread.livechat_visitor_id else False,
            "livechat_session_id": thread.id if thread else False,
            "project_id": project.id,
            "issue_type_id": issue_type.id,
            "severity_id": severity.id,
            "origin": "llm_tool",
            "reported_by_id": kwargs.get("reported_by_id"),
            "privacy_visibility": "portal",
        }
        return vals

    def _get_severity(self, **kwargs) -> Any:
        """Get the severity for the support ticket.

        Args:
            **kwargs: Additional keyword arguments to include in the ticket values.

        Returns:
            Any: The severity to use for the support ticket.
        """
        SupportIssueSeverity = self.env["support.issue.severity"]
        severity_id = kwargs.get("severity_id", False)

        if severity_id:
            severity = SupportIssueSeverity.sudo().browse(severity_id)
            if severity.exists():
                return severity

        # If no valid severity_id is provided, return a default (by sequence)
        default_severity = SupportIssueSeverity.sudo().search([], order="sequence asc", limit=1)
        return default_severity

    def _get_issue_type(self, **kwargs) -> Any:
        """Get the issue type for the support ticket.

        Args:
            **kwargs: Additional keyword arguments to include in the ticket values.

        Returns:
            Any: The issue type to use for the support ticket.
        """
        SupportIssueType = self.env["support.issue.type"]
        issue_type_id = kwargs.get("issue_type_id", False)

        if issue_type_id:
            issue_type = SupportIssueType.sudo().browse(issue_type_id)
            if issue_type.exists():
                return issue_type

        # If no valid issue_type_id is provided, return a default (by sequence)
        default_issue_type = SupportIssueType.sudo().search([], order="sequence asc", limit=1)
        return default_issue_type

    def _get_or_create_project(self, **kwargs) -> Any:
        """Get or create a project for the support ticket.

        Returns:
            Any: The project to use for the support ticket.
        """
        Project = self.env["project.project"]
        project_id = kwargs.get("project_id", False)

        # try with explicit project_id
        if project_id:
            project = Project.sudo().browse(project_id)
            if project.exists():
                return project

        # try get a project from visitor / partner
        # visitor must be authenticated / not public
        # if multiple projects are found, better not use them to avoid confusion
        visitor = kwargs.get("visitor", False)
        if visitor and visitor.partner_id and not visitor.partner_id.is_public:
            projects = Project.sudo().search([("partner_id", "=", visitor.partner_id.id)])
            if len(projects) == 1:
                return projects[0]

        # try to get one for support
        # if get more than one ... discard them to avoid confusion
        projects = Project.sudo().search([("support_issue_project", "=", True)])
        if len(projects) == 1:
            return projects[0]

        # try get one with tag 'helpdesk_default'
        project = Project.sudo().search([("tag_ids.name", "=", "helpdesk_default")], limit=1)
        if project.exists():
            return project

        # get or create a new project named 'Helpdesk'
        new_project = Project.sudo().search([("name", "=", _("Helpdesk"))], limit=1)
        if new_project.exists():
            return new_project
        new_project = Project.sudo().create(
            {
                "name": _("Helpdesk"),
                "type_id": False,
                "support_issue_project": True,
                "privacy_visibility": "portal",
            }
        )
        return new_project

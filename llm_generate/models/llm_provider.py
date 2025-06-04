from odoo import models


class LLMProvider(models.Model):
    _inherit = "llm.provider"

    def generate_io_schema(self, model_record):
        """Generate a configuration from raw schema components

        Args:
            model_record (llm.model): The model record to generate config for
        """
        return self._dispatch("generate_io_schema", model_record=model_record)

    def generate_media(self, inputs, model_record=None, stream=False):
        """Generate media content using the specified model and inputs

        Args:
            inputs (dict): Input parameters according to the input schema
            model_record (llm.model): The model to use for generation
            stream (bool): Whether to stream the response

        Returns:
            Generated content in the format specified by the output processing config
        """
        return self._dispatch(
            "generate_media", inputs, model_record=model_record, stream=stream
        )

    def format_generation_response(self, raw_response, output_schema):
        """Format the raw generation response according to the output processing config

        Args:
            raw_response: The raw response from the provider
            output_schema (dict): Schema of the output

        Returns:
            Processed response in the format specified by the config
        """
        return self._dispatch(
            "format_generation_response", raw_response, output_schema=output_schema
        )

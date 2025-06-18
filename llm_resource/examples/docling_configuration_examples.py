#!/usr/bin/env python3
"""
Example usage of the Configurable Docling Parser

This script demonstrates how to use the new configurable Docling parser
with various configuration options for different document processing scenarios.
"""

# Example 1: High-Quality OCR Processing Configuration
HIGH_QUALITY_OCR_CONFIG = {
    'parser': 'docling',
    'docling_do_ocr': True,
    'docling_ocr_language': 'en',
    'docling_use_gpu': True,
    'docling_do_table_structure': True,
    'docling_do_cell_matching': True,
    'docling_accelerator_device': 'auto',
    'docling_num_threads': 4,
    'docling_backend': 'docling_parse',
    'docling_extract_tables': True,
    'docling_extract_figures': True,
    'docling_preserve_layout': True,
}

# Example 2: Fast Processing (Low Resource Usage)
FAST_PROCESSING_CONFIG = {
    'parser': 'docling',
    'docling_do_ocr': False,  # Disable for native PDFs
    'docling_do_table_structure': True,
    'docling_do_cell_matching': False,  # Disable for speed
    'docling_accelerator_device': 'cpu',
    'docling_num_threads': 2,
    'docling_backend': 'pypdfium',  # Lighter backend
    'docling_extract_tables': True,
    'docling_extract_figures': False,  # Skip figures for speed
    'docling_preserve_layout': False,
}

# Example 3: Maximum Quality (High Resource Usage)
MAXIMUM_QUALITY_CONFIG = {
    'parser': 'docling',
    'docling_do_ocr': True,
    'docling_ocr_language': 'en',
    'docling_use_gpu': True,
    'docling_do_table_structure': True,
    'docling_do_cell_matching': True,
    'docling_accelerator_device': 'cuda',  # Force GPU if available
    'docling_num_threads': 8,
    'docling_backend': 'docling_parse',
    'docling_extract_tables': True,
    'docling_extract_figures': True,
    'docling_preserve_layout': True,
}

# Example 4: Multilingual Document Processing
MULTILINGUAL_CONFIG = {
    'parser': 'docling',
    'docling_do_ocr': True,
    'docling_ocr_language': 'es',  # Spanish documents
    'docling_use_gpu': True,
    'docling_do_table_structure': True,
    'docling_do_cell_matching': True,
    'docling_accelerator_device': 'auto',
    'docling_num_threads': 4,
    'docling_backend': 'docling_parse',
    'docling_extract_tables': True,
    'docling_extract_figures': True,
    'docling_preserve_layout': True,
}

def configure_resource_for_scenario(resource, scenario="high_quality"):
    """
    Configure a resource with predefined scenarios.
    
    Args:
        resource: LLM Resource record
        scenario: Configuration scenario ('high_quality', 'fast', 'maximum', 'multilingual')
    """
    
    configs = {
        'high_quality': HIGH_QUALITY_OCR_CONFIG,
        'fast': FAST_PROCESSING_CONFIG,
        'maximum': MAXIMUM_QUALITY_CONFIG,
        'multilingual': MULTILINGUAL_CONFIG,
    }
    
    config = configs.get(scenario, HIGH_QUALITY_OCR_CONFIG)
    
    # Apply configuration to resource
    resource.write(config)
    
    return resource

def batch_configure_resources(env, domain, scenario="high_quality"):
    """
    Configure multiple resources with the same scenario.
    
    Args:
        env: Odoo environment
        domain: Search domain for resources
        scenario: Configuration scenario
    """
    
    resources = env['llm.resource'].search(domain)
    
    for resource in resources:
        configure_resource_for_scenario(resource, scenario)
    
    return resources

# Example usage in Odoo shell:
"""
# Configure a single resource for high-quality processing
resource = env['llm.resource'].browse(1)
configure_resource_for_scenario(resource, 'high_quality')
resource.parse()

# Batch configure all retrieved resources for fast processing
domain = [('state', '=', 'retrieved')]
resources = batch_configure_resources(env, domain, 'fast')
resources.parse()

# Configure multilingual resources
spanish_resources = env['llm.resource'].search([
    ('state', '=', 'retrieved'),
    ('name', 'ilike', 'spanish')
])
for resource in spanish_resources:
    configure_resource_for_scenario(resource, 'multilingual')
    resource.parse()
"""

def get_configuration_recommendations(document_type, system_specs):
    """
    Get configuration recommendations based on document type and system specifications.
    
    Args:
        document_type: Type of document ('scanned_pdf', 'native_pdf', 'complex_layout', 'simple_text')
        system_specs: System specifications dict with 'ram_gb', 'has_gpu', 'cpu_cores'
    
    Returns:
        dict: Recommended configuration
    """
    
    base_config = {
        'parser': 'docling',
        'docling_do_ocr': False,
        'docling_ocr_language': 'en',
        'docling_use_gpu': False,
        'docling_do_table_structure': True,
        'docling_do_cell_matching': False,
        'docling_accelerator_device': 'cpu',
        'docling_num_threads': min(system_specs.get('cpu_cores', 4), 4),
        'docling_backend': 'pypdfium',
        'docling_extract_tables': True,
        'docling_extract_figures': True,
        'docling_preserve_layout': True,
    }
    
    # Adjust based on document type
    if document_type == 'scanned_pdf':
        base_config.update({
            'docling_do_ocr': True,
            'docling_use_gpu': system_specs.get('has_gpu', False),
            'docling_do_cell_matching': True,
            'docling_backend': 'docling_parse',
        })
    
    elif document_type == 'complex_layout':
        base_config.update({
            'docling_do_cell_matching': True,
            'docling_backend': 'docling_parse',
        })
    
    elif document_type == 'simple_text':
        base_config.update({
            'docling_extract_figures': False,
            'docling_preserve_layout': False,
        })
    
    # Adjust based on system specs
    if system_specs.get('ram_gb', 4) >= 8:
        base_config['docling_do_cell_matching'] = True
        base_config['docling_num_threads'] = min(system_specs.get('cpu_cores', 4), 6)
    
    if system_specs.get('has_gpu', False):
        base_config.update({
            'docling_accelerator_device': 'auto',
            'docling_use_gpu': True,
        })
    
    return base_config

# Example system configurations
EXAMPLES = {
    'high_end_system': {
        'ram_gb': 16,
        'has_gpu': True,
        'cpu_cores': 8,
    },
    'mid_range_system': {
        'ram_gb': 8,
        'has_gpu': False,
        'cpu_cores': 4,
    },
    'low_end_system': {
        'ram_gb': 4,
        'has_gpu': False,
        'cpu_cores': 2,
    },
}

if __name__ == "__main__":
    print("Docling Parser Configuration Examples")
    print("=" * 50)
    
    for system_name, specs in EXAMPLES.items():
        print(f"\n{system_name.replace('_', ' ').title()}:")
        print(f"  RAM: {specs['ram_gb']}GB, GPU: {specs['has_gpu']}, CPU Cores: {specs['cpu_cores']}")
        
        for doc_type in ['scanned_pdf', 'native_pdf', 'complex_layout', 'simple_text']:
            config = get_configuration_recommendations(doc_type, specs)
            print(f"  {doc_type.replace('_', ' ').title()}:")
            print(f"    OCR: {config['docling_do_ocr']}, GPU: {config['docling_use_gpu']}")
            print(f"    Threads: {config['docling_num_threads']}, Backend: {config['docling_backend']}")

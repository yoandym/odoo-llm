# Models

Document the key models in this module:

```python
class MainModel(models.Model):
    _name = 'module.main_model'
    _description = 'Main Model Description'
    
    # Key fields explanation
    field1 = fields.Char('Field 1', help='Purpose of this field')
    field2 = fields.Many2one('other.model', string='Field 2', help='Relationship explanation')
    
    # Key methods explanation
    def important_method(self):
        """
        Explain what this method does and why it's important
        """
        pass
```
# Controllers

Describe the controllers if your module includes any web controllers:

```python
class MainController(http.Controller):
    @http.route('/module/endpoint', type='http', auth='user')
    def controller_method(self, **kwargs):
        # Explain what this controller does
        pass
```
/** @odoo-module **/

const { Component } = owl;

export class LLMChatComposer extends Component {

  static template = "llm_thread.LLMChatComposer";
  static props = {
    record: { type: Object, optional: true },
  };

  /**
   * @override
   */
  setup() {
    super.setup();
    //useComponentToModel({ fieldName: "component" });  # TODO: remove this line
  }
  /**
   * @returns {Composer}
   */
  get composerView() {
    return this.props.record;
  }

  /**
   * @returns {Boolean}
   */
  get isDisabled() {
    // Read the computed disabled state from the model.
    return this.composerView.composer.isSendDisabled;
  }

  get isStreaming() {
    return this.composerView.composer.isStreaming;
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  /**
   * Intercept send button click
   * @private
   */
  _onClickSend() {
    if (this.isDisabled) {
      return;
    }

    this.composerView.composer.postUserMessageForLLM();
  }
  /**
   * Handles click on the stop button.
   *
   * @private
   */
  _onClickStop() {
    this.composerView.composer.stopLLMThreadLoop();
  }
}

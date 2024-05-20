import { DbDocument } from "../../types/dbdocument";
import { Post } from "../../types/post";
import dbDocument from "../../schemas/dbdocument.json";
import post from "../../schemas/post.json";

const Ajv = require("ajv");
const ajv = new Ajv();
const documentValidator = ajv.compile(dbDocument);
const postValidator = ajv.compile(post);

/**
 * A class of Helper functions used repeatedly across our program.
 * Each helper function usually has a singular and straightforward responsibility.
 * This allows us to debug the program centrally.
 */
export default class Helpers {
  /**
   * Checks the input document's validity and throws an
   * error if it is not valid.
   * @param inputResponse a document in the database
   */
  static checkDocumentValidity(inputResponse: DbDocument) {
    const isValidDocument = documentValidator(inputResponse);

    if (!isValidDocument) {
      const errString =
        "Error with JSON validation: " +
        ajv.errorsText(documentValidator.errors);
      alert(errString);
      console.log(errString);
      console.log(inputResponse);
      throw new Error(errString);
    }
  }

  /**
   * Checks the given post's validity and throws an error if
   * it is not valid.
   * @param inputResponse a post in the database
   */
  static checkPostValidity(inputResponse: Post) {
    const isValidPost = postValidator(inputResponse);

    if (!isValidPost) {
      const errString =
        "Error with JSON validation: " + ajv.errorsText(postValidator.errors);
      alert(errString);
      console.log(errString);
      console.log(inputResponse);
      throw new Error(errString);
    }
  }

  /**
   * Verifies that the input event is a custom event.
   * @param event an event
   * @returns the value of the event
   */
  static isCustomEvent(event: Event): event is CustomEvent {
    return "detail" in event;
  }
}

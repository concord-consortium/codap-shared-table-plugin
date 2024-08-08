/// <reference types="cypress" />
import { AppElements as ae } from "../support/elements/app-elements";

context("Test the overall app", () => {
  beforeEach(() => {
    cy.visit("");
  });

  describe("Desktop functionalities", () => {
    it("renders with text", () => {
      ae.getApp().should("have.text", "To create or join a collaborative table");
    });
  });
});

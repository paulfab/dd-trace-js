/* eslint-disable */
context('can do visits', () => {
  it('renders a hello world second', () => {
    cy.get('.hello-world')
      .should('have.text', 'Hello World')
  })
})

interface ITemplateVariables {
  [key: string]: string | number | boolean;
}

export default interface IParseMailTemplateDTO {
  file: string;
  variables: ITemplateVariables;
}

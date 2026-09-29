interface ITemplateVariables {
  [key: string]: string | number | boolean | string[];
}

export default interface IParseMailTemplateDTO {
  file: string;
  variables: ITemplateVariables;
}

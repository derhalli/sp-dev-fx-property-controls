import * as React from 'react';
import styles from '../PropertyFieldCollectionDataHost.module.scss';
import { ICollectionDataItemProps, ICollectionDataItemState } from '.';
import { TextField } from 'office-ui-fabric-react/lib/components/TextField';
import { Icon } from 'office-ui-fabric-react/lib/components/Icon';
import { Link } from 'office-ui-fabric-react/lib/components/Link';
import { Checkbox } from 'office-ui-fabric-react/lib/components/Checkbox';
import * as strings from 'PropertyControlStrings';
import { ICustomCollectionField, CustomCollectionFieldType, FieldValidator } from '..';
import { Dropdown } from 'office-ui-fabric-react/lib/components/Dropdown';
import { Callout, DirectionalHint } from 'office-ui-fabric-react/lib/components/Callout';
import { CollectionIconField } from '../collectionIconField';
import { clone, findIndex, sortBy } from '@microsoft/sp-lodash-subset';
import { CollectionNumberField } from '../collectionNumberField';

export class CollectionDataItem extends React.Component<ICollectionDataItemProps, ICollectionDataItemState> {
  private emptyItem: any = null;
  private validation: FieldValidator = {};
  private calloutCellRef: HTMLElement;

  constructor(props: ICollectionDataItemProps) {
    super(props);

    // Create an empty item with all properties
    this.emptyItem = {};
    for (const field of this.props.fields) {
      // Assign default value or null to the emptyItem
      this.emptyItem[field.id] = field.defaultValue || null;
    }

    this.state = {
      crntItem: clone(this.props.item) || {...this.emptyItem},
      errorMsgs: [],
      showCallout: false
    };
  }

  /**
   * componentDidUpdate lifecycle hook
   * @param prevProps
   * @param prevState
   */
  public componentDidUpdate(prevProps: ICollectionDataItemProps): void {
    if (this.props.item !== prevProps.item) {
      this.setState({
        crntItem: clone(this.props.item)
      });
    }
  }

  /**
   * Update the item value on the field change
   */
  private onValueChanged = (fieldId: string, value: any): void => {
    this.setState((prevState: ICollectionDataItemState): ICollectionDataItemState => {
      const { crntItem } = prevState;
      // Update the changed field
      crntItem[fieldId] = value;

      // Check if current item is valid
      if (this.props.fAddInCreation) {
        if (this.checkAllRequiredFieldsValid(crntItem) &&
            this.checkAnyFieldContainsValue(crntItem) &&
            this.checkAllFieldsAreValid()) {
          this.props.fAddInCreation(crntItem);
        } else {
          this.props.fAddInCreation(null);
        }
      }

      // Check if item needs to be updated
      if (this.props.fUpdateItem) {
        this.updateItem();
      }

      // Store this in the current state
      return { crntItem };
    });
  }

  /**
   * Check if all values of the required fields are provided
   */
  private checkAllRequiredFieldsValid(item: any): boolean {
    // Get all the required fields
    const requiredFields = this.props.fields.filter(f => f.required);
    // Check all the required field values
    for (const field of requiredFields) {
      if (typeof item[field.id] === "undefined" || item[field.id] === null || item[field.id] === "") {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if any of the fields contain a value
   * @param item
   */
  private checkAnyFieldContainsValue(item: any): boolean {
    const { fields } = this.props;
    for (const field of fields) {
      if (typeof item[field.id] !== "undefined" && item[field.id] !== null && item[field.id] !== "") {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the add action needs to be disabled
   */
  private disableAdd(item: any) {
    return !this.checkAllRequiredFieldsValid(item) || !this.checkAnyFieldContainsValue(item) || !this.checkAllFieldsAreValid() || !this.props.fAddItem;
  }

  /**
   * Checks if all fields are valid
   */
  private checkAllFieldsAreValid(): boolean {
    if (this.validation) {
      const keys = Object.keys(this.validation);
      for (const key of keys) {
        if (!this.validation[key]) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Add the current row to the collection
   */
  private addRow = () => {
    if (this.props.fAddItem) {
      const { crntItem } = this.state;
      // Check if all the fields are correctly provided
      if (this.checkAllRequiredFieldsValid(crntItem) &&
          this.checkAnyFieldContainsValue(crntItem) &&
          this.checkAllFieldsAreValid()) {
        this.props.fAddItem(crntItem);
        // Clear all field values
        this.setState({
          crntItem: {...this.emptyItem}
        });
      }
    }
  }

  /**
   * Add the current row to the collection
   */
  private updateItem = () => {
    const { crntItem } = this.state;
    const isValid = this.checkAllRequiredFieldsValid(crntItem) && this.checkAnyFieldContainsValue(crntItem) && this.checkAllFieldsAreValid();

    if (this.props.fUpdateItem) {
      // Check if all the fields are correctly provided
      if (isValid) {
        this.props.fUpdateItem(this.props.index, crntItem);
      }
    }

    // Set the validation for the item
    if (this.props.fValidation) {
      this.props.fValidation(this.props.index, isValid);
    }
  }

  /**
   * Delete the item from the collection
   */
  private deleteRow = () => {
    if (this.props.fDeleteItem) {
      this.props.fDeleteItem(this.props.index);
    }
  }

  /**
   * Allow custom field validation
   *
   * @param field
   * @param value
   */
  private fieldValidation = async (field: ICustomCollectionField, value: any): Promise<string> => {
    let validation = "";
    if (field.onGetErrorMessage) {
      validation = await field.onGetErrorMessage(value, this.props.index, this.state.crntItem);
    }
    // Store the field validation
    this.validation[field.id] = validation === "";
    // Trigger field change
    this.onValueChanged(field.id, value);
    // Add message for the error callout
    this.errorCalloutHandler(field.id, validation);
    return validation;
  }

  /**
   * Error callout message handler
   *
   * @param field
   * @param message
   */
  private errorCalloutHandler(fieldId: string, message: string) {
    this.setState((prevState: ICollectionDataItemState) => {
      let { crntItem, errorMsgs } = prevState;

      // Get the current field
      const fieldIdx = findIndex(this.props.fields, f => f.id === fieldId);
      if (fieldIdx === -1) {
        return;
      }
      const field = this.props.fields[fieldIdx];

      // Check if there already is a message for the field
      const fieldMsgIdx = findIndex(errorMsgs, msg => msg.field === field.title);

      // Add message
      let fieldMsg;
      if (fieldMsgIdx === -1) {
        fieldMsg = {
          field: field.title,
          message: message
        };
      } else {
        // Update message
        fieldMsg = errorMsgs[fieldMsgIdx];
        if (fieldMsg) {
          fieldMsg.message = message;
        }
      }

      // Check if field required message needs to be shown
      if (field.required) {
        if (typeof crntItem[field.id] === "undefined" || crntItem[field.id] === null || crntItem[field.id] === "") {
          fieldMsg.isRequired = true;
        } else {
          fieldMsg.isRequired = false;
        }
      }

      // If required and message are false, it doesn't need to be added
      if (!fieldMsg.message && !fieldMsg.isRequired) {
        // Remove the item
        if (fieldMsgIdx !== -1) {
          errorMsgs.splice(fieldMsgIdx, 1);
        }
      } else {
        if (fieldMsgIdx === -1) {
          errorMsgs.push(fieldMsg);
        }
      }

      // Sort based on the index
      errorMsgs = sortBy(errorMsgs, ["field"]);

      return {
        errorMsgs
      };
    });
  }

  /**
   * Toggle the error callout
   */
  private toggleErrorCallout = () => {
    this.setState((prevState: ICollectionDataItemState) => ({
      showCallout: !prevState.showCallout
    }));
  }

  private hideErrorCallout = () => {
    this.setState({
      showCallout: false
    });
  }

  /**
   * Render the field
   *
   * @param field
   * @param item
   */
  private renderField(field: ICustomCollectionField, item: any) {
    switch(field.type) {
      case CustomCollectionFieldType.boolean:
        return <Checkbox checked={item[field.id] ? item[field.id] : false}
                         onChange={(ev, value) => this.onValueChanged(field.id, value)} />;
      case CustomCollectionFieldType.dropdown:
        return <Dropdown placeHolder={field.placeholder || field.title}
                         options={field.options}
                         selectedKey={item[field.id] || null}
                         required={field.required}
                         onChanged={(opt) => this.onValueChanged(field.id, opt.key)} />;
      case CustomCollectionFieldType.number:
        return (
          <CollectionNumberField field={field} item={item} fOnValueChange={this.onValueChanged} fValidation={this.fieldValidation} />
        );
      case CustomCollectionFieldType.fabricIcon:
        return (
          <CollectionIconField field={field} item={item} fOnValueChange={this.onValueChanged} fValidation={this.fieldValidation} />
        );
      case CustomCollectionFieldType.url:
        return <TextField placeholder={field.placeholder || field.title}
                          value={item[field.id] ? item[field.id] : ""}
                          required={field.required}
                          className={styles.collectionDataField}
                          onGetErrorMessage={async (value) => {
                            let isValid = true;
                            let validation = "";

                            // Check if custom validation is configured
                            if (field.onGetErrorMessage) {
                              // Using the custom validation
                              validation = await field.onGetErrorMessage(value, this.props.index, item);
                              isValid = validation === "";
                            } else {
                              // Check if entered value is a valid URL
                              const regEx: RegExp = /^((http|https)?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                              isValid = (value === null || value.length === 0 || regEx.test(value));
                              validation = isValid ? "" : strings.InvalidUrlError;
                            }

                            // Store the field validation
                            this.validation[field.id] = isValid;
                            // Trigger field change
                            this.onValueChanged(field.id, value);
                            // Add message for the error callout
                            this.errorCalloutHandler(field.id, validation);
                            // Return the error message if needed
                            return validation;
                          }} />;
      case CustomCollectionFieldType.string:
      default:
        return <TextField placeholder={field.placeholder || field.title}
                          className={styles.collectionDataField}
                          value={item[field.id] ? item[field.id] : ""}
                          required={field.required}
                          onChanged={(value) => this.onValueChanged(field.id, value)}
                          onGetErrorMessage={(value: string) => this.fieldValidation(field, value)} />;
    }
  }

  /**
   * Default React render
   */
  public render(): React.ReactElement<ICollectionDataItemProps> {
    const { crntItem } = this.state;

    return (
      <div className={`${styles.tableRow} ${this.props.index === null ? styles.tableFooter : ""}`}>
        {
          this.props.fields.map(f => (
            <span className={`${styles.tableCell} ${styles.inputField}`}>{this.renderField(f, crntItem)}</span>
          ))
        }

        <span className={styles.tableCell}>
          <span ref={ref => this.calloutCellRef = ref}>
            <Link title={strings.CollectionDataItemShowErrorsLabel}
                  className={styles.errorCalloutLink}
                  disabled={!this.state.errorMsgs || this.state.errorMsgs.length === 0}
                  onClick={this.toggleErrorCallout}>
              <Icon iconName="Error" />
            </Link>
          </span>

          {
            this.state.showCallout && (
              <Callout className={styles.errorCallout}
                       target={this.calloutCellRef}
                       isBeakVisible={true}
                       directionalHint={DirectionalHint.bottomLeftEdge}
                       directionalHintForRTL={DirectionalHint.rightBottomEdge}
                       onDismiss={this.hideErrorCallout}>
                {
                  (this.state.errorMsgs && this.state.errorMsgs.length > 0) && (
                    <div className={styles.errorMsgs}>
                      <p>Field issues:</p>
                      <ul>
                        {
                          this.state.errorMsgs.map(msg => (
                            <li><b>{msg.field}</b>: {msg.message ? msg.message : msg.isRequired ? strings.CollectionDataItemFieldRequiredLabel : null}</li>
                          ))
                        }
                      </ul>
                    </div>
                  )
                }
              </Callout>
            )
          }
        </span>

        <span className={styles.tableCell}>
        {
          /* Check add or delete action */
          this.props.index !== null ? (
            <Link title={strings.CollectionDeleteRowButtonLabel} disabled={!this.props.fDeleteItem} onClick={this.deleteRow}>
              <Icon iconName="Clear" />
            </Link>
          ) : (
            <Link title={strings.CollectionAddRowButtonLabel} className={`${this.disableAdd(crntItem) ? "" : styles.addBtn}`} disabled={this.disableAdd(crntItem)} onClick={this.addRow}>
              <Icon iconName="Add" />
            </Link>
          )
        }
        </span>
      </div>
    );
  }
}

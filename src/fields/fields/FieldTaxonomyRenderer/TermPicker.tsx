import * as React from 'react';
import { BasePicker, IBasePickerProps, IPickerItemProps } from 'office-ui-fabric-react/lib/Pickers';
import styles from './TaxonomyPicker.module.scss';
import { ITaxonomyPickerProps, IPickerTerm, ITermPickerProps, ITermPickerState } from './interfaces';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { IFieldProps } from '../../interfaces';
import SPTermStorePickerService from './SPTermStorePickerService';

export class TermBasePicker extends BasePicker<IPickerTerm, IBasePickerProps<IPickerTerm>> {

}

export default class TermPicker extends React.Component<ITermPickerProps, ITermPickerState> {
  private allTerms: IPickerTerm[] = [];

  /**
   * Constructor method
   */
  constructor(props: any) {
    super(props);
    this.onRenderItem = this.onRenderItem.bind(this);
    this.onRenderSuggestionsItem = this.onRenderSuggestionsItem.bind(this);
    this.onFilterChanged = this.onFilterChanged.bind(this);
    this.onGetTextFromItem = this.onGetTextFromItem.bind(this);

    this.state = {
      terms: this.props.value
    };

  }

  /**
   * componentWillReceiveProps method
   */
  public componentWillReceiveProps(nextProps: ITermPickerProps) {
    // check to see if props is different to avoid re-rendering
    let newKeys = nextProps.value.map(a => a.key);
    let currentKeys = this.state.terms.map(a => a.key);
    if (newKeys.sort().join(',') !== currentKeys.sort().join(',')) {
      this.setState({ terms: nextProps.value });
    }
  }

  public render(): JSX.Element {
    return (
      <div>
        <TermBasePicker
          disabled={this.props.disabled}
          onResolveSuggestions={this.onFilterChanged}
          onRenderSuggestionsItem={this.onRenderSuggestionsItem}
          getTextFromItem={this.onGetTextFromItem}
          onRenderItem={this.onRenderItem}
          defaultSelectedItems={this.props.value}
          selectedItems={this.state.terms}
          onChange={this.props.onChanged}
          itemLimit={!this.props.allowMultipleSelections ? 1 : undefined}
          className={styles.termBasePicker}
        />
      </div>
    );
  }

  /**
   * Renders the item in the picker
   */
  protected onRenderItem(term: IPickerItemProps<IPickerTerm>) {
    return (
      <div className={styles.pickedTermRoot}
           key={term.index}
           data-selection-index={term.index}
           data-is-focusable={!term.disabled && true}>
        <span className={styles.pickedTermText}>{term.item.name}</span>
        {
          !term.disabled && (
            <span className={styles.pickedTermCloseIcon}
              onClick={term.onRemoveItem}>
              <Icon iconName='Cancel' />
            </span>
          )
        }
      </div>
    );
  }

  /**
   * Renders the suggestions in the picker
   */
  protected onRenderSuggestionsItem(term: IPickerTerm) {
    let termParent = term.termSetName;
    let termTitle = `${term.name} [${term.termSetName}]`;
    if (term.path.indexOf(';') !== -1) {
      let splitPath = term.path.split(';');
      termParent = splitPath[splitPath.length - 2];
      splitPath.pop();
      termTitle = `${term.name} [${term.termSetName}:${splitPath.join(':')}]`;
    }
    return (
      <div className={styles.termSuggestion} title={termTitle}>
        <div>{term.name}</div>
        <div className={styles.termSuggestionSubTitle}> {'TaxonomyPickerInLabel'} {termParent ? termParent : 'TaxonomyPickerTermSetLabel'}</div>
      </div>
    );
  }

  /**
   * When Filter Changes a new search for suggestions
   */
  private async onFilterChanged(filterText: string, tagList: IPickerTerm[]): Promise<IPickerTerm[]> {
    if (filterText !== '') {
      let termsService = new SPTermStorePickerService(this.props.fieldProps);
      let terms: IPickerTerm[] = await termsService.searchTermsByName(filterText);
      // Check if the termset can be selected
      if (this.props.isTermSetSelectable) {
        // Retrieve the current termset
        const termSet = await termsService.getTermSet();
        // Check if termset was retrieved and if it contains the filter value
        if (termSet && termSet.Name.toLowerCase().indexOf(filterText.toLowerCase()) === 0) {
          // Add the termset to the suggestion list
          terms.push({
            key: termsService.cleanGuid(termSet.Id),
            name: termSet.Name,
            path: '',
            termSet: termsService.cleanGuid(termSet.Id)
          });
        }
      }

      // Filter out the terms which are already set
      const filteredTerms = [];
      const { disabledTermIds, disableChildrenOfDisabledParents } = this.props;
      for (const term of terms) {
        let canBePicked = true;

        // Check if term is not disabled
        if (disabledTermIds && disabledTermIds.length > 0) {
          // Check if current term need to be disabled
          if (disabledTermIds.indexOf(term.key) !== -1) {
            canBePicked = false;
          } else {
            // Check if child terms need to be disabled
            if (disableChildrenOfDisabledParents) {
              // Check if terms were already retrieved
              if (!this.allTerms) {
                this.allTerms = await termsService.getAllTerms(this.props.fieldProps.TaxonomyTermSetId);
              }

              // Check if there are terms retrieved
              if (this.allTerms.length > 0) {
                // Find the disabled parents
                const disabledParents = this.allTerms.filter(t => disabledTermIds.indexOf(t.key) !== -1);
                // Check if disabled parents were found
                if (disabledParents && disabledParents.length > 0) {
                  // Check if the current term lives underneath a disabled parent
                  const findTerm = disabledParents.filter(pt => term.path.indexOf(pt.path) !== -1);
                  if (findTerm && findTerm.length > 0) {
                    canBePicked = false;
                  }
                }
              }
            }
          }
        }

        if (canBePicked) {
          // Only retrieve the terms which are not yet tagged
          if (tagList.filter(tag => tag.key === term.key).length === 0) {
            filteredTerms.push(term);
          }
        }
      }
      return filteredTerms;
    } else {
      return Promise.resolve([]);
    }
  }

  /**
   * gets the text from an item
   */
  private onGetTextFromItem(item: any): any {
    return item.name;
  }
}
import { MetadataFormData } from "@saleor/components/Metadata";
import { GiftCardError } from "@saleor/fragments/types/GiftCardError";
import { giftCardUpdateFormMessages } from "@saleor/giftCards/GiftCardsList/messages";
import { MutationResultWithOpts } from "@saleor/hooks/makeMutation";
import useForm, { FormChange, UseFormResult } from "@saleor/hooks/useForm";
import useNotifier from "@saleor/hooks/useNotifier";
import { getDefaultNotifierSuccessErrorData } from "@saleor/hooks/useNotifier/utils";
import useStateFromProps from "@saleor/hooks/useStateFromProps";
import { getFormErrors } from "@saleor/utils/errors";
import handleFormSubmit from "@saleor/utils/handlers/handleFormSubmit";
import createMetadataUpdateHandler from "@saleor/utils/handlers/metadataUpdateHandler";
import { mapMetadataItemToInput } from "@saleor/utils/maps";
import getMetadata from "@saleor/utils/metadata/getMetadata";
import {
  useMetadataUpdate,
  usePrivateMetadataUpdate
} from "@saleor/utils/metadata/updateMetadata";
import useMetadataChangeTrigger from "@saleor/utils/metadata/useMetadataChangeTrigger";
import difference from "lodash/difference";
import React, { createContext } from "react";
import { useIntl } from "react-intl";

import {
  GiftCardCreateFormData,
  initialData as emptyFormData
} from "../../../GiftCardCreateDialog/GiftCardCreateDialogForm";
import { useGiftCardUpdateMutation } from "../../mutations";
import { GiftCardUpdate } from "../../types/GiftCardUpdate";
import useGiftCardDetails from "../GiftCardDetailsProvider/hooks/useGiftCardDetails";

interface GiftCardUpdateFormProviderProps {
  children: React.ReactNode;
}

export type GiftCardUpdateFormData = MetadataFormData &
  Pick<GiftCardCreateFormData, "tags" | "expiryDate">;

export interface GiftCardUpdateFormConsumerData
  extends GiftCardUpdateFormErrors {
  opts: MutationResultWithOpts<GiftCardUpdate>;
}

export interface GiftCardUpdateFormErrors {
  formErrors: Record<"tags" | "expiryDate", GiftCardError>;
  handlers: { changeMetadata: FormChange };
}

export type GiftCardUpdateFormConsumerProps = UseFormResult<
  GiftCardUpdateFormData
> &
  GiftCardUpdateFormConsumerData;

export const GiftCardUpdateFormContext = createContext<
  GiftCardUpdateFormConsumerProps
>(null);

// const useGiftCardTagsAddRemove = (
//   initTags: string[],
//   changedTags: string[]
// ) => {
//   const [tags] = useStateFromProps(initTags);

//   const removed = difference(tags, changedTags);
//   const added = difference(changedTags, tags);

//   // console.log({ removed, added });

//   // return addTags, removeTags

//   return {
//     addTags: added,
//     removeTags: removed
//   };
// };

const getGiftCardTagsAddRemoveData = (
  initTags: string[],
  changedTags: string[]
) => {
  const removed = difference(initTags, changedTags);
  const added = difference(changedTags, initTags);

  return {
    addTags: added,
    removeTags: removed
  };
};

const GiftCardUpdateFormProvider: React.FC<GiftCardUpdateFormProviderProps> = ({
  children
}) => {
  const notify = useNotifier();
  const intl = useIntl();
  const [updateMetadata] = useMetadataUpdate({});
  const [updatePrivateMetadata] = usePrivateMetadataUpdate({});

  const { loading: loadingGiftCard, giftCard } = useGiftCardDetails();

  const getInitialData = (): GiftCardUpdateFormData => {
    if (loadingGiftCard || !giftCard) {
      return { ...emptyFormData, metadata: [], privateMetadata: [] };
    }

    const { tags, expiryDate, privateMetadata, metadata } = giftCard;

    return {
      tags: tags.map(({ name }) => name),
      expiryDate,
      privateMetadata: privateMetadata?.map(mapMetadataItemToInput),
      metadata: metadata?.map(mapMetadataItemToInput)
    };
  };

  const onSubmit = (data: GiftCardUpdate) => {
    const errors = data.giftCardUpdate.errors;
    const hasExpiryError = errors.some(error => error.field === "expiryDate");

    notify(
      hasExpiryError
        ? {
            title: intl.formatMessage(
              giftCardUpdateFormMessages.giftCardInvalidExpiryDateHeader
            ),
            text: intl.formatMessage(
              giftCardUpdateFormMessages.giftCardInvalidExpiryDateContent
            ),
            status: "error"
          }
        : getDefaultNotifierSuccessErrorData(errors, intl)
    );
  };

  const [updateGiftCard, updateGiftCardOpts] = useGiftCardUpdateMutation({
    onCompleted: onSubmit
  });

  const submit = async ({ tags, expiryDate }: GiftCardUpdateFormData) => {
    const result = await updateGiftCard({
      variables: {
        id: giftCard?.id,
        input: {
          // tags: [tag],
          expiryDate,
          // removeTags: [null],
          // addTags: [null]
          ...getGiftCardTagsAddRemoveData(
            giftCard.tags.map(el => el.name),
            tags
          )
        }
      }
    });

    return result?.data?.giftCardUpdate?.errors;
  };

  const formProps = useForm<GiftCardUpdateFormData>(getInitialData());

  const { data, change, setChanged, hasChanged } = formProps;

  // console.log({ data });

  const {
    isMetadataModified,
    isPrivateMetadataModified,
    makeChangeHandler: makeMetadataChangeHandler
  } = useMetadataChangeTrigger();

  const changeMetadata = makeMetadataChangeHandler(change);

  const submitData: GiftCardUpdateFormData = {
    ...data,
    ...getMetadata(data, isMetadataModified, isPrivateMetadataModified)
  };

  const handleSubmit = createMetadataUpdateHandler(
    giftCard,
    submit,
    variables => updateMetadata({ variables }),
    variables => updatePrivateMetadata({ variables })
  );

  const formSubmit = () =>
    handleFormSubmit(submitData, handleSubmit, setChanged);

  const formErrors = getFormErrors(
    ["tags", "expiryDate"],
    updateGiftCardOpts?.data?.giftCardUpdate?.errors
  );

  const providerValues = {
    ...formProps,
    opts: updateGiftCardOpts,
    hasChanged,
    formErrors,
    submit: formSubmit,
    handlers: {
      changeMetadata
    }
  };

  return (
    <GiftCardUpdateFormContext.Provider value={providerValues}>
      {children}
    </GiftCardUpdateFormContext.Provider>
  );
};

export default GiftCardUpdateFormProvider;

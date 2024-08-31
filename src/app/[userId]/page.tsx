"use client";
import { useSession } from "next-auth/react";
import Error from "next/error";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { DefaultLayout } from "@/app/_components/DefaultLayout";
import { UserIcon } from "@/app/_components/UserIcon";
import { api } from "@/trpc/react";
import {
  tweetContentSchema,
  type TweetContentSchema,
} from "@/validations/tweet";
import { useParams } from "next/navigation";
import { TweetList } from "@/app/_components/TweetList";
import produce from "immer";

export default function UserIdIndex() {
  const { data: session } = useSession();
  const {
    register,
    handleSubmit,
    formState: { isValid },
    reset,
  } = useForm({
    resolver: zodResolver(tweetContentSchema),
    defaultValues: { content: "" },
  });
  const params = useParams();
  const userId = String(params.userId);
  const { data: user, isLoading: isLoadingUser } =
    api.user.getByUserId.useQuery({
      userId,
    });
  const tweetAddMutation = api.tweet.add.useMutation();
  const { data: tweets = [], isLoading: isLoadingTweets } =
    api.tweet.getAllByUserId.useQuery({ userId });
  const utils = api.useUtils();
  const tweetLikeLikeOrUnlikeMutation =
    api.tweetLike.likeOrUnlike.useMutation();

  if (isLoadingUser)
    return (
      <DefaultLayout session={session}>
        <div>Loading...</div>
      </DefaultLayout>
    );

  if (!user) {
    return <Error statusCode={404} />;
  }

  function onSubmit({ content }: TweetContentSchema) {
    if (tweetAddMutation.isPending) return;
    tweetAddMutation.mutate(
      { content },
      {
        onSuccess(data) {
          utils.tweet.getAllByUserId.setData({ userId: data.userId }, [
            data,
            ...tweets,
          ]);
        },
      },
    );
    reset();
  }

  function handleLikeClick(tweetId: string) {
    if (!session) {
      alert("ログインしてください。");
      return;
    }
    if (tweetLikeLikeOrUnlikeMutation.isPending) return;
    tweetLikeLikeOrUnlikeMutation.mutate(
      { tweetId },
      {
        onSuccess(data) {
          utils.tweet.getAllByUserId.setData({ userId }, (old) =>
            produce(old, (draft) => {
              const tweet = draft?.find((t) => t.id === tweetId);
              if (!tweet) return draft;
              const likeIndex = tweet.likes.findIndex(
                (like) => like.userId === data.userId,
              );
              if (likeIndex === -1) {
                tweet.likes.push(data);
              } else {
                tweet.likes.splice(likeIndex, 1);
              }
            }),
          );
        },
      },
    );
  }

  return (
    <DefaultLayout session={session}>
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <div className="h-24 w-24">
            <UserIcon {...user} />
          </div>
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{user?.name ?? "no name"}</h1>
          <div className="text-slate-700">@{user?.id ?? "---"}</div>
        </div>
      </div>
      <div className="mt-4">
        {userId === session?.user.id && (
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="flex flex-col items-end gap-2"
          >
            <textarea
              {...register("content")}
              rows={4}
              className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm text-slate-900"
              placeholder="いまどうしてる？"
              minLength={1}
              maxLength={140}
            ></textarea>
            <button
              className="rounded-full bg-sky-500 px-5 py-3 text-white disabled:opacity-50"
              disabled={!isValid || tweetAddMutation.isPending}
            >
              ツイートする
            </button>
          </form>
        )}
        <div>
          <h2 className="mb-2 font-bold">ツイート</h2>
          <TweetList
            tweets={tweets}
            isLoading={isLoadingTweets}
            handleLikeClick={handleLikeClick}
            currentUserId={session?.user.id}
          />
        </div>
      </div>
    </DefaultLayout>
  );
}

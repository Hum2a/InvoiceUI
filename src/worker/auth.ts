import { betterAuth } from 'better-auth'
import { magicLink } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/neon-http'
import { Resend } from 'resend'
import * as schema from './auth-schema'

export function auth(env:Env){return betterAuth({appName:'InvoiceUI',baseURL:env.APP_URL,secret:env.BETTER_AUTH_SECRET,database:drizzleAdapter(drizzle(env.DATABASE_URL,{schema}),{provider:'pg',schema}),trustedOrigins:[env.APP_URL],rateLimit:{enabled:true,storage:'database',window:60,max:20},session:{expiresIn:60*60*24*7},databaseHooks:{user:{create:{before:async user=>user.email.toLowerCase()===env.OWNER_EMAIL.toLowerCase()?{data:user}:false}}},plugins:[magicLink({storeToken:'hashed',expiresIn:600,rateLimit:{window:60,max:3},sendMagicLink:async({email,url})=>{if(email.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())return;const {error}=await new Resend(env.RESEND_API_KEY).emails.send({from:env.EMAIL_FROM,to:email,subject:'Sign in to InvoiceUI',text:`Use this link to sign in to your private invoice workspace. It expires in 10 minutes.\n\n${url}\n\nIf you did not request this, ignore this message.`});if(error)throw new Error('Sign-in email could not be sent')}})]})}
